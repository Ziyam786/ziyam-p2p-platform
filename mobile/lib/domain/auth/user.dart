/// Mirrors the fields of `prisma/schema.prisma`'s `User` model that this
/// app is allowed to see. `kycDocUrl` and `aadhaarVerifiedName` are
/// deliberately NOT modeled here — per data-model.md / constitution
/// Principle II, only the derived `isKycVerified` state is client-visible.
class ZiyamUser {
  const ZiyamUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.phoneNumber,
    required this.isKycVerified,
    this.isDrivingLicenseVerified = false,
    this.avatarUrl,
    this.bio,
  });

  final String id;
  final String fullName;
  final String email;
  final String phoneNumber;
  final bool isKycVerified;

  /// A separate gate from `isKycVerified` — `POST /booking` requires BOTH
  /// to be true (`booking.routes.ts:122-132`) or it 403s with a distinct
  /// error code the booking checkout screen must handle (see spec.md's
  /// corrected Assumptions).
  final bool isDrivingLicenseVerified;
  final String? avatarUrl;
  final String? bio;

  factory ZiyamUser.fromJson(Map<String, dynamic> json) => ZiyamUser(
        id: json['id'] as String,
        fullName: json['fullName'] as String,
        email: json['email'] as String,
        phoneNumber: json['phoneNumber'] as String,
        isKycVerified: json['isKycVerified'] as bool? ?? false,
        isDrivingLicenseVerified: json['isDrivingLicenseVerified'] as bool? ?? false,
        avatarUrl: json['avatarUrl'] as String?,
        bio: json['bio'] as String?,
      );

  ZiyamUser copyWith({String? fullName, String? phoneNumber, String? bio, String? avatarUrl}) =>
      ZiyamUser(
        id: id,
        fullName: fullName ?? this.fullName,
        email: email,
        phoneNumber: phoneNumber ?? this.phoneNumber,
        isKycVerified: isKycVerified,
        isDrivingLicenseVerified: isDrivingLicenseVerified,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        bio: bio ?? this.bio,
      );
}

/// The three states a renter's KYC verification can be in, per data-model.md.
/// The backend today only exposes a boolean (`isKycVerified`); `rejected`
/// is included for forward-compatibility if that ever changes, and maps to
/// `pending` until the backend distinguishes it.
enum KycStatus { pending, verified, rejected }

extension KycStatusFromUser on ZiyamUser {
  KycStatus get kycStatus => isKycVerified ? KycStatus.verified : KycStatus.pending;
}
