import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/auth/auth_repository.dart';
import '../data/booking/booking_repository.dart';
import '../data/fleet/fleet_repository.dart';
import '../data/itinerary/itinerary_repository.dart';
import '../data/profile/profile_repository.dart';
import '../domain/auth/user.dart';
import 'api_client.dart';
import 'token_storage.dart';

/// One `ApiClient`/`TokenStorage` instance for the whole app — every
/// repository shares it so the bearer token stays consistent (see
/// core/api_client.dart).
final apiClientProvider = Provider<ApiClient>((ref) => ApiClient());
final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(apiClient: ref.watch(apiClientProvider), tokenStorage: ref.watch(tokenStorageProvider)),
);

final fleetRepositoryProvider = Provider<FleetRepository>(
  (ref) => FleetRepository(apiClient: ref.watch(apiClientProvider)),
);

final bookingRepositoryProvider = Provider<BookingRepository>(
  (ref) => BookingRepository(apiClient: ref.watch(apiClientProvider)),
);

final itineraryRepositoryProvider = Provider<ItineraryRepository>(
  (ref) => ItineraryRepository(apiClient: ref.watch(apiClientProvider)),
);

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(apiClient: ref.watch(apiClientProvider)),
);

/// The current signed-in user, or null. Screens read this instead of each
/// re-fetching `/auth/me`. Set on login/signup/session-restore, cleared on
/// logout — see auth_repository.dart.
final currentUserProvider = StateProvider<ZiyamUser?>((ref) => null);
