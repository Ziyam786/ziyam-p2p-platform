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

/// Matches `prisma/schema.prisma`'s real `BookingStatus` enum exactly — the
/// two-stage Razorpay checkout (reservation fee, then balance) moves a
/// booking through `pendingPayment` -> `reserved` -> `pendingHostReview` ->
/// `confirmed`/`rejected` -> `active` -> `completed`/`cancelled`. Do not
/// invent status names without checking the schema — this enum previously
/// had a fabricated `PENDING_APPROVAL` value that never existed server-side.
enum BookingStatus {
  pending,
  pendingPayment,
  reserved,
  pendingHostReview,
  confirmed,
  active,
  completed,
  cancelled,
  rejected,
  unknown;

  static BookingStatus fromWire(String? value) {
    switch (value) {
      case 'PENDING':
        return BookingStatus.pending;
      case 'PENDING_PAYMENT':
        return BookingStatus.pendingPayment;
      case 'RESERVED':
        return BookingStatus.reserved;
      case 'PENDING_HOST_REVIEW':
        return BookingStatus.pendingHostReview;
      case 'CONFIRMED':
        return BookingStatus.confirmed;
      case 'ACTIVE':
        return BookingStatus.active;
      case 'COMPLETED':
        return BookingStatus.completed;
      case 'CANCELLED':
        return BookingStatus.cancelled;
      case 'REJECTED':
        return BookingStatus.rejected;
      default:
        return BookingStatus.unknown;
    }
  }
}

/// What `POST /booking/:id/checkout-session` (and `/balance-checkout-session`,
/// and `POST /itineraries/unlock`) return — `PaymentGateway.initiateCheckout`'s
/// Razorpay Orders API result (see contracts/rest-api.md). `keyId` is
/// Razorpay's public key id, safe to hand to the client — it opens
/// Razorpay Checkout against this order, never a secret.
class RazorpayCheckoutSession {
  const RazorpayCheckoutSession({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
  });

  final String orderId;

  /// Paise (Razorpay's base unit) — what Razorpay Checkout's `amount`
  /// option expects directly, no conversion needed client-side.
  final int amount;
  final String currency;
  final String keyId;

  factory RazorpayCheckoutSession.fromJson(Map<String, dynamic> json) => RazorpayCheckoutSession(
        orderId: json['orderId'] as String,
        amount: (json['amount'] as num).toInt(),
        currency: json['currency'] as String,
        keyId: json['keyId'] as String,
      );
}
