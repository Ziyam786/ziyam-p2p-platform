import '../../core/api_client.dart';
import '../../domain/booking/booking.dart';
import '../../domain/itinerary/itinerary_unlock.dart';

/// Consumes the existing `/itineraries/*` routes as-is — unauthenticated by
/// design (see contracts/rest-api.md and research.md's correction).
///
/// Post-Razorpay-migration: generation is now server-side. Once
/// `/payments/razorpay/verify` (see data/payments/razorpay_verify.dart)
/// confirms payment, `razorpayPaymentHandler.ts` generates the itinerary
/// content synchronously (via the backend's Claude/Anthropic chat service,
/// not client-side Firebase AI Logic/Gemini as originally built) and stores
/// it before that call even returns — the client just fetches `getById`
/// afterward. There is no client-side generation step and no
/// `/itineraries/:id/content` call anymore.
class ItineraryRepository {
  ItineraryRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<({String id, RazorpayCheckoutSession checkout})> unlock({
    required String destination,
    required String customerName,
    required String customerEmail,
    required String customerPhone,
  }) async {
    final response = await _api.post<Map<String, dynamic>>('/itineraries/unlock', data: {
      'destination': destination,
      'customerName': customerName,
      'customerEmail': customerEmail,
      'customerPhone': customerPhone,
    });
    final data = response.data!['data'] as Map<String, dynamic>;
    return (id: data['id'] as String, checkout: RazorpayCheckoutSession.fromJson(data));
  }

  Future<ItineraryUnlock> getById(String id) async {
    final response = await _api.get<Map<String, dynamic>>('/itineraries/$id');
    return ItineraryUnlock.fromJson(response.data!['data'] as Map<String, dynamic>);
  }
}
