import '../../core/api_client.dart';
import '../../domain/booking/booking.dart';

/// Consumes the existing `POST /booking` and `/booking/:id/checkout-session`
/// routes as-is (see contracts/rest-api.md's Booking section). The
/// no-double-booking guarantee (FR-007) is enforced server-side by the
/// `$transaction` fix tracked in tasks.md T011 — this repository does not
/// attempt to re-implement locking client-side. Checkout sessions return a
/// Razorpay order (see RazorpayCheckoutSession) — open it via
/// `presentation/shared/razorpay_checkout.dart`, then verify with
/// `data/payments/razorpay_verify.dart`.
class BookingRepository {
  BookingRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<String> create({
    required String carId,
    required DateTime startTime,
    required DateTime endTime,
    required double totalAmount,
    String protectionPlan = 'BASIC',
    bool deliveryRequested = false,
    String? promoCode,
    bool coDriverRequested = false,
    String? coDriverName,
    String? coDriverLicenseNumber,
  }) async {
    final response = await _api.post<Map<String, dynamic>>('/booking', data: {
      'carId': carId,
      'startTime': startTime.toIso8601String(),
      'endTime': endTime.toIso8601String(),
      'totalAmount': totalAmount,
      'protectionPlan': protectionPlan,
      'deliveryRequested': deliveryRequested,
      'promoCode': ?promoCode,
      'coDriverRequested': coDriverRequested,
      'coDriverName': ?coDriverName,
      'coDriverLicenseNumber': ?coDriverLicenseNumber,
    });
    return response.data!['bookingId'] as String;
  }

  Future<RazorpayCheckoutSession> checkoutSession(String bookingId) async {
    final response = await _api.post<Map<String, dynamic>>('/booking/$bookingId/checkout-session');
    return RazorpayCheckoutSession.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  Future<RazorpayCheckoutSession> balanceCheckoutSession(String bookingId) async {
    final response =
        await _api.post<Map<String, dynamic>>('/booking/$bookingId/balance-checkout-session');
    return RazorpayCheckoutSession.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  /// Note the plural path — `GET /bookings/:id` (in `user.routes.ts`), not
  /// `/booking/:id`. The backend's route naming is inconsistent between
  /// singular (`POST /booking`, `checkout-session`) and plural (`GET
  /// /bookings/:id`, `cancel`); this repository follows the real routes as
  /// they exist rather than normalizing them, since that's a separate
  /// backend cleanup this feature doesn't need to make.
  Future<Booking> getById(String bookingId) async {
    final response = await _api.get<Map<String, dynamic>>('/bookings/$bookingId');
    return Booking.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  /// `GET /users/me/bookings` — trip history for the logged-in renter.
  Future<List<Booking>> myBookings() async {
    final response = await _api.get<Map<String, dynamic>>('/users/me/bookings');
    final list = (response.data!['data'] as List?) ?? const [];
    return list.cast<Map<String, dynamic>>().map(Booking.fromJson).toList();
  }
}
