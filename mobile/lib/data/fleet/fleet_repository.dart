import '../../core/api_client.dart';
import '../../domain/fleet/car.dart';

/// Consumes the existing `GET /cars`, `/cars/:id`, `/cars/:id/availability`
/// routes as-is — same fleet data `src/frontend` shows, no new endpoints
/// (see contracts/rest-api.md's Fleet section).
class FleetRepository {
  FleetRepository({ApiClient? apiClient}) : _api = apiClient ?? ApiClient();

  final ApiClient _api;

  Future<List<Car>> search({String? category, String? query, String? city}) async {
    final response = await _api.get<Map<String, dynamic>>('/cars', query: {
      if (category != null && category.isNotEmpty) 'category': category,
      if (query != null && query.isNotEmpty) 'q': query,
      if (city != null && city.isNotEmpty) 'city': city,
      'availableOnly': true,
    });
    final list = (response.data!['data'] as List).cast<Map<String, dynamic>>();
    return list.map(Car.fromJson).toList();
  }

  Future<Car> getById(String carId) async {
    final response = await _api.get<Map<String, dynamic>>('/cars/$carId');
    return Car.fromJson(response.data!['data'] as Map<String, dynamic>);
  }

  Future<List<AvailabilityBlock>> availability(String carId) async {
    final response = await _api.get<Map<String, dynamic>>('/cars/$carId/availability');
    final list = (response.data!['data'] as List?) ?? const [];
    return list.cast<Map<String, dynamic>>().map(AvailabilityBlock.fromJson).toList();
  }

  /// Client-side confirmation that a chosen range doesn't hit a known
  /// block, purely for immediate UI feedback — the backend transaction
  /// (see research.md's Principle III fix) is the actual source of truth
  /// and is re-checked on `POST /booking` regardless of this result.
  bool isRangeFree(List<AvailabilityBlock> blocks, DateTime start, DateTime end) {
    return !blocks.any((b) => b.overlaps(start, end));
  }
}
