import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/providers.dart';
import 'core/router.dart';
import 'core/theme.dart';
import 'firebase_options.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    // Guarded: firebase_options.dart is a placeholder until `flutterfire
    // configure` runs (tasks.md T004) — everything except itinerary AI
    // generation works without a real Firebase project, so a failed init
    // here must not crash the whole app.
    await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  } catch (e) {
    debugPrint('[main] Firebase.initializeApp skipped/failed (expected until flutterfire configure runs): $e');
  }
  runApp(const ProviderScope(child: ZiyamApp()));
}

class ZiyamApp extends ConsumerStatefulWidget {
  const ZiyamApp({super.key});

  @override
  ConsumerState<ZiyamApp> createState() => _ZiyamAppState();
}

class _ZiyamAppState extends ConsumerState<ZiyamApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = buildRouter();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final user = await ref.read(authRepositoryProvider).restoreSession();
    if (user != null) ref.read(currentUserProvider.notifier).state = user;
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Ziyam SelfDrive',
      debugShowCheckedModeBanner: false,
      theme: ziyamLightTheme(),
      darkTheme: ziyamDarkTheme(),
      routerConfig: _router,
    );
  }
}
