import 'package:go_router/go_router.dart';

import '../presentation/auth/login_screen.dart';
import '../presentation/auth/signup_screen.dart';
import '../presentation/booking/booking_checkout_screen.dart';
import '../presentation/booking/booking_detail_screen.dart';
import '../presentation/booking/booking_list_screen.dart';
import '../presentation/fleet/browse_screen.dart';
import '../presentation/fleet/car_detail_screen.dart';
import '../presentation/itinerary/destination_pick_screen.dart';
import '../presentation/itinerary/itinerary_history_screen.dart';
import '../presentation/itinerary/itinerary_view_screen.dart';
import '../presentation/profile/kyc_status_screen.dart';
import '../presentation/profile/profile_screen.dart';
import 'auth_state.dart';

/// Auth-gated navigation (FR-001/FR-002): unauthenticated users can only
/// reach /login and /signup; everything else redirects there. See
/// core/auth_state.dart for why this uses a plain ChangeNotifier rather
/// than a Riverpod provider directly.
GoRouter buildRouter() {
  return GoRouter(
    initialLocation: '/login',
    refreshListenable: AuthState.instance,
    redirect: (context, state) {
      final loggedIn = AuthState.instance.isAuthenticated;
      final onAuthScreen = state.matchedLocation == '/login' || state.matchedLocation == '/signup';
      if (!loggedIn && !onAuthScreen) return '/login';
      if (loggedIn && onAuthScreen) return '/browse';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (context, state) => const SignupScreen()),
      GoRoute(path: '/browse', builder: (context, state) => const BrowseScreen()),
      GoRoute(
        path: '/cars/:carId',
        builder: (context, state) => CarDetailScreen(carId: state.pathParameters['carId']!),
        routes: [
          GoRoute(
            path: 'book',
            builder: (context, state) => BookingCheckoutScreen(carId: state.pathParameters['carId']!),
          ),
        ],
      ),
      GoRoute(path: '/bookings', builder: (context, state) => const BookingListScreen()),
      GoRoute(
        path: '/bookings/:bookingId',
        builder: (context, state) => BookingDetailScreen(bookingId: state.pathParameters['bookingId']!),
      ),
      GoRoute(path: '/itineraries', builder: (context, state) => const DestinationPickScreen()),
      GoRoute(path: '/itineraries/history', builder: (context, state) => const ItineraryHistoryScreen()),
      GoRoute(
        path: '/itineraries/:itineraryId',
        builder: (context, state) => ItineraryViewScreen(itineraryId: state.pathParameters['itineraryId']!),
      ),
      GoRoute(path: '/profile', builder: (context, state) => const ProfileScreen()),
      GoRoute(path: '/profile/kyc', builder: (context, state) => const KycStatusScreen()),
    ],
  );
}
