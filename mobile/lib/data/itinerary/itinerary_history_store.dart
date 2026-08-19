import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists which itinerary ids this device has unlocked, so a renter can
/// reopen a past purchase (FR-009) without needing to remember the id
/// themselves — the id is the resource's only access token (see
/// research.md's correction on ItineraryUnlock being id-scoped, not
/// user-linked).
class ItineraryHistoryStore {
  ItineraryHistoryStore({FlutterSecureStorage? storage}) : _storage = storage ?? const FlutterSecureStorage();

  static const _key = 'ziyam_itinerary_history';

  final FlutterSecureStorage _storage;

  Future<List<String>> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null || raw.isEmpty) return const [];
    final decoded = jsonDecode(raw);
    return (decoded as List).cast<String>();
  }

  Future<void> add(String itineraryId) async {
    final current = await read();
    if (current.contains(itineraryId)) return;
    await _storage.write(key: _key, value: jsonEncode([...current, itineraryId]));
  }
}
