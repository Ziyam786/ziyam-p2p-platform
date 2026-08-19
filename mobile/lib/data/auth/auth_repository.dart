import '../../core/api_client.dart';
import '../../core/auth_state.dart';
import '../../core/token_storage.dart';
import '../../domain/auth/user.dart';

/// Talks to the existing `/auth/*` routes — same accounts `src/frontend`
/// uses. See specs/001-flutter-renter-app/contracts/rest-api.md: login now
/// also returns the signed JWT in the body (T010) so this cookie-less
/// client can store and replay it as `Authorization: Bearer <jwt>` (T009).
class AuthRepository {
  AuthRepository({ApiClient? apiClient, TokenStorage? tokenStorage})
      : _api = apiClient ?? ApiClient(),
        _tokenStorage = tokenStorage ?? TokenStorage();

  final ApiClient _api;
  final TokenStorage _tokenStorage;

  Future<ZiyamUser> signup({
    required String fullName,
    required String email,
    required String phoneNumber,
    required String password,
  }) async {
    final response = await _api.post<Map<String, dynamic>>('/auth/signup', data: {
      'fullName': fullName,
      'email': email,
      'phoneNumber': phoneNumber,
      'password': password,
    });
    return _handleAuthResponse(response.data!);
  }

  Future<ZiyamUser> login({required String email, required String password}) async {
    final response = await _api.post<Map<String, dynamic>>('/auth/login', data: {
      'email': email,
      'password': password,
    });
    return _handleAuthResponse(response.data!);
  }

  Future<ZiyamUser?> restoreSession() async {
    final token = await _tokenStorage.readToken();
    if (token == null || token.isEmpty) return null;
    try {
      final response = await _api.get<Map<String, dynamic>>('/auth/me');
      final user = ZiyamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
      AuthState.instance.setAuthenticated(true);
      return user;
    } on ApiException {
      await logout();
      return null;
    }
  }

  Future<void> logout() async {
    await _tokenStorage.clearToken();
    AuthState.instance.setAuthenticated(false);
  }

  /// `data` stays the user object directly (unchanged shape, matches
  /// `src/frontend`'s existing consumption) — `token` is added as a
  /// sibling top-level field, per T010's additive-only response change.
  /// See contracts/rest-api.md.
  ZiyamUser _handleAuthResponse(Map<String, dynamic> body) {
    final token = body['token'] as String?;
    if (token == null || token.isEmpty) {
      throw ApiException('Sign-in succeeded but no session token was returned.');
    }
    final user = ZiyamUser.fromJson(body['data'] as Map<String, dynamic>);
    _tokenStorage.saveToken(token);
    AuthState.instance.setAuthenticated(true);
    return user;
  }
}
