import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

const _tabs = [
  (icon: Icons.directions_car_filled, label: 'Fleet', path: '/browse'),
  (icon: Icons.event_note, label: 'Trips', path: '/bookings'),
  (icon: Icons.map_outlined, label: 'Itineraries', path: '/itineraries'),
  (icon: Icons.person_outline, label: 'Profile', path: '/profile'),
];

/// Bottom tab bar shared by the four top-level sections (Story 1–4 entry
/// points) so they read as one app rather than four dead-end screens.
class AppBottomNav extends StatelessWidget {
  const AppBottomNav({super.key, required this.currentPath});

  final String currentPath;

  @override
  Widget build(BuildContext context) {
    final index = _tabs.indexWhere((t) => t.path == currentPath).clamp(0, _tabs.length - 1);
    return NavigationBar(
      selectedIndex: index,
      onDestinationSelected: (i) => context.go(_tabs[i].path),
      destinations: [
        for (final tab in _tabs) NavigationDestination(icon: Icon(tab.icon), label: tab.label),
      ],
    );
  }
}
