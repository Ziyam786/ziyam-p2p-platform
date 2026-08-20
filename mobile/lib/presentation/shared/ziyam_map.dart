import 'package:flutter/material.dart';
import 'package:mappls_gl/mappls_gl.dart';

/// Wraps `MapplsMap` behind the app's own widget so every screen that needs
/// a map (car location today; live trip tracking later) goes through one
/// place. NOT wired into any screen yet — `Car`/`Booking` have no
/// latitude/longitude field today (only free-text `address`/`city`), so
/// there is no real coordinate to center on without either geocoding the
/// address client-side or the backend adding lat/lng columns. Do that
/// first; don't fabricate coordinates to make this "look" wired up.
///
/// Requires a Mappls access token, supplied at build time (never hardcoded
/// — same rule as every other credential in this app):
///
///   flutter run --dart-define=MAPPLS_ACCESS_TOKEN=your_token_here
///
/// On web, the token is separately baked into `web/index.html`'s Mappls
/// `<script>` tag at build time — see the comment there.
class MapplsAccessToken {
  static const value = String.fromEnvironment('MAPPLS_ACCESS_TOKEN');
}

class ZiyamMap extends StatelessWidget {
  const ZiyamMap({super.key, required this.centerLat, required this.centerLng, this.zoom = 14.0});

  final double centerLat;
  final double centerLng;
  final double zoom;

  @override
  Widget build(BuildContext context) {
    if (MapplsAccessToken.value.isEmpty) {
      return Container(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        alignment: Alignment.center,
        child: const Padding(
          padding: EdgeInsets.all(16),
          child: Text(
            'Map unavailable — no MAPPLS_ACCESS_TOKEN configured for this build.',
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    return MapplsMap(
      initialCameraPosition: CameraPosition(target: LatLng(centerLat, centerLng), zoom: zoom),
    );
  }
}
