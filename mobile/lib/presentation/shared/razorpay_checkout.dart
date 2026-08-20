/// Conditional export so the web build never even sees
/// `import 'package:razorpay_flutter/...'` — that package wraps native
/// Android/iOS SDKs only and fails to resolve at compile time on web, not
/// just at runtime. Defaults to the web stub; falls back to the real
/// `dart:io`-only implementation on Android/iOS/desktop.
library;
export 'razorpay_checkout_web.dart' if (dart.library.io) 'razorpay_checkout_io.dart';
