import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Wraps the platform keychain/keystore for the session JWT. This is the
/// mobile equivalent of the `ziyam_session` httpOnly cookie the web app
/// relies on — same JWT, different transport (see
/// specs/001-flutter-renter-app/contracts/rest-api.md).
class TokenStorage {
  TokenStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _tokenKey = 'ziyam_auth_token';

  final FlutterSecureStorage _storage;

  Future<String?> readToken() => _storage.read(key: _tokenKey);

  Future<void> saveToken(String token) => _storage.write(key: _tokenKey, value: token);

  Future<void> clearToken() => _storage.delete(key: _tokenKey);
}
