import '../../core/api_client.dart';
import '../../domain/auth/user.dart';

/// Consumes the existing `GET`/`PATCH /users/me` routes as-is. The
/// backend's own `PUBLIC_USER_SELECT` (`user.routes.ts:13-38`) already
/// excludes `kycDocUrl` and `aadhaarVerifiedName` from this response — this
/// repository still parses only through `ZiyamUser.fromJson`, which has no
/// field for either, as a second line of defense per constitution
/// Principle II.
class ProfileRepository {
  ProfileRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<ZiyamUser> getMe() async {
    final response = await _api.get<Map<String, dynamic>>('/users/me');
    return ZiyamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  Future<ZiyamUser> updateMe({String? fullName, String? phoneNumber, String? bio, String? avatarUrl}) async {
    final response = await _api.patch<Map<String, dynamic>>('/users/me', data: {
      'fullName': ?fullName,
      'phoneNumber': ?phoneNumber,
      'bio': ?bio,
      'avatarUrl': ?avatarUrl,
    });
    return ZiyamUser.fromJson(response.data!['data'] as Map<String, dynamic>);
  }
}
