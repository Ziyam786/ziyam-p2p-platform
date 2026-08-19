// Smoke test for the login screen — the app's actual entry point
// (main.dart's ZiyamApp) touches platform plugins (secure storage,
// Firebase) that aren't available in a plain widget-test environment, so
// this exercises LoginScreen directly rather than the full app shell. See
// tasks.md T013.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:mobile/presentation/auth/login_screen.dart';

void main() {
  testWidgets('LoginScreen shows email/password fields and a submit button', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(home: LoginScreen()),
      ),
    );

    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Email'), findsOneWidget);
    expect(find.widgetWithText(TextFormField, 'Password'), findsOneWidget);
    expect(find.widgetWithText(ElevatedButton, 'Log in'), findsOneWidget);

    // Submitting empty fields must show validation errors, not silently
    // proceed or crash (part of FR-014's "don't silently discard/accept
    // bad input").
    await tester.tap(find.widgetWithText(ElevatedButton, 'Log in'));
    await tester.pump();
    expect(find.text('Email is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });
}
