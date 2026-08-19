import '../../core/api_client.dart';
import '../../domain/booking/booking.dart';
import '../../domain/itinerary/itinerary_unlock.dart';

/// Consumes the existing `/itineraries/*` routes as-is — unauthenticated by
/// design (see contracts/rest-api.md and research.md's correction). No
/// backend changes needed for this repository at all.
class ItineraryRepository {
  ItineraryRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<({String id, PayuCheckout checkout})> unlock({
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
    return (
      id: data['id'] as String,
      checkout: PayuCheckout(url: data['url'] as String, fields: (data['fields'] as Map).map((k, v) => MapEntry(k.toString(), v.toString()))),
    );
  }

  Future<ItineraryUnlock> getById(String id) async {
    final response = await _api.get<Map<String, dynamic>>('/itineraries/$id');
    return ItineraryUnlock.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  Future<ItineraryUnlock> submitContent(String id, String generatedContent) async {
    final response = await _api.post<Map<String, dynamic>>('/itineraries/$id/content', data: {
      'generatedContent': generatedContent,
    });
    return ItineraryUnlock.fromJson(response.data!['data'] as Map<String, dynamic>);
  }
}
