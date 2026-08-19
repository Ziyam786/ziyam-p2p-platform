import 'package:dio/dio.dart';

import 'token_storage.dart';

/// The single base URL every repository talks to — same `src/backend`
/// Express API the web app uses, never a second backend (constitution
/// Principle I). Override at build time with
/// `--dart-define=API_BASE_URL=https://...`.
class ApiConfig {
  static const baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:5000/api',
  );
}

/// A normalized failure shape so every screen can render a consistent
/// offline/error state (FR-014) instead of leaking raw exception text.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.isNetworkError = false, this.code});

  final String message;
  final int? statusCode;
  final bool isNetworkError;

  /// The backend's machine-readable `code` field, when present (e.g.
  /// `KYC_REQUIRED`, `DRIVING_LICENSE_REQUIRED` from `booking.routes.ts`) —
  /// lets a screen react to a specific failure instead of only showing text.
  final String? code;

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}

/// Thin wrapper around `dio` that injects the bearer token on every request
/// (the mobile equivalent of the browser's `credentials: 'include'` cookie
/// jar — see contracts/rest-api.md's Auth section) and normalizes failures.
class ApiClient {
  ApiClient({TokenStorage? tokenStorage, Dio? dio})
      : _tokenStorage = tokenStorage ?? TokenStorage(),
        _dio = dio ??
            Dio(BaseOptions(
              baseUrl: ApiConfig.baseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
            )) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _tokenStorage.readToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) => handler.next(error),
      ),
    );
  }

  final Dio _dio;
  final TokenStorage _tokenStorage;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? query}) =>
      _run(() => _dio.get<T>(path, queryParameters: query));

  Future<Response<T>> post<T>(String path, {Object? data}) =>
      _run(() => _dio.post<T>(path, data: data));

  Future<Response<T>> patch<T>(String path, {Object? data}) =>
      _run(() => _dio.patch<T>(path, data: data));

  Future<Response<T>> _run<T>(Future<Response<T>> Function() call) async {
    try {
      return await call();
    } on DioException catch (e) {
      if (e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        throw ApiException('No connection to Ziyam — check your network and try again.',
            isNetworkError: true);
      }
      final status = e.response?.statusCode;
      final data = e.response?.data;
      final serverMessage = data is Map && data['error'] is String ? data['error'] as String : null;
      final serverCode = data is Map && data['code'] is String ? data['code'] as String : null;
      throw ApiException(serverMessage ?? 'Something went wrong. Please try again.',
          statusCode: status, code: serverCode);
    }
  }
}
