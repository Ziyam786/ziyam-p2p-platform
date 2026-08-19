/// Mirrors `prisma/schema.prisma`'s `Booking` model. `coDriverLicenseNumber`
/// is present because a co-driver add-on needs it to function, but per
/// data-model.md/constitution Principle II it must be masked in any list
/// or summary rendering — only the single field-level edit control that
/// captured it may show it unmasked (see `maskedCoDriverLicense`).
class Booking {
  const Booking({
    required this.id,
    required this.carId,
    required this.startTime,
    required this.endTime,
    required this.totalAmount,
    required this.platformFee,
    required this.protectionPlan,
    required this.status,
    this.deliveryRequested = false,
    this.deliveryFeeAmount = 0,
    this.coDriverRequested = false,
    this.coDriverName,
    this.coDriverLicenseNumber,
  });

  final String id;
  final String carId;
  final DateTime startTime;
  final DateTime endTime;
  final double totalAmount;
  final double platformFee;
  final String protectionPlan;
  final BookingStatus status;
  final bool deliveryRequested;
  final double deliveryFeeAmount;
  final bool coDriverRequested;
  final String? coDriverName;
  final String? coDriverLicenseNumber;

  String? get maskedCoDriverLicense {
    final v = coDriverLicenseNumber;
    if (v == null || v.length < 4) return v == null ? null : '••••';
    return '•' * (v.length - 4) + v.substring(v.length - 4);
  }

  factory Booking.fromJson(Map<String, dynamic> json) => Booking(
        id: json['id'] as String,
        carId: json['carId'] as String,
        startTime: DateTime.parse(json['startTime'] as String),
        endTime: DateTime.parse(json['endTime'] as String),
        totalAmount: (json['totalAmount'] as num).toDouble(),
        platformFee: (json['platformFee'] as num?)?.toDouble() ?? 0,
        protectionPlan: json['protectionPlan'] as String? ?? 'BASIC',
        status: BookingStatus.fromWire(json['status'] as String?),
        deliveryRequested: json['deliveryRequested'] as bool? ?? false,
        deliveryFeeAmount: (json['deliveryFeeAmount'] as num?)?.toDouble() ?? 0,
        coDriverRequested: json['coDriverRequested'] as bool? ?? false,
        coDriverName: json['coDriverName'] as String?,
        coDriverLicenseNumber: json['coDriverLicenseNumber'] as String?,
      );
}

enum BookingStatus {
  pendingPayment,
  confirmed,
  pendingApproval,
  cancelled,
  completed,
  unknown;

  static BookingStatus fromWire(String? value) {
    switch (value) {
      case 'CONFIRMED':
        return BookingStatus.confirmed;
      case 'PENDING_APPROVAL':
        return BookingStatus.pendingApproval;
      case 'PENDING_PAYMENT':
        return BookingStatus.pendingPayment;
      case 'CANCELLED':
        return BookingStatus.cancelled;
      case 'COMPLETED':
        return BookingStatus.completed;
      default:
        return BookingStatus.unknown;
    }
  }
}

/// What the checkout-session endpoint returns — the same PayU hosted
/// checkout shape used for itinerary unlock (see contracts/rest-api.md).
class PayuCheckout {
  const PayuCheckout({required this.url, required this.fields});

  final String url;
  final Map<String, String> fields;

  factory PayuCheckout.fromJson(Map<String, dynamic> json) => PayuCheckout(
        url: json['url'] as String,
        fields: (json['fields'] as Map).map((k, v) => MapEntry(k.toString(), v.toString())),
      );
}
