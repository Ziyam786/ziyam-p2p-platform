import 'package:flutter/foundation.dart';

/// Cross-cutting "am I logged in" signal used only to gate router
/// navigation. Screens that need actual user data go through
/// `AuthRepository`/Riverpod, not this — this exists purely because
/// `go_router`'s `redirect` needs a `Listenable` to react to auth changes.
class AuthState extends ChangeNotifier {
  AuthState._();

  static final AuthState instance = AuthState._();

  bool isAuthenticated = false;

  void setAuthenticated(bool value) {
    if (isAuthenticated == value) return;
    isAuthenticated = value;
    notifyListeners();
  }
}
