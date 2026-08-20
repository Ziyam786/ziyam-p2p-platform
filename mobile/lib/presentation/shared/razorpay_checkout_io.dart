import 'dart:async';

import 'package:razorpay_flutter/razorpay_flutter.dart';

/// Android/iOS implementation — `razorpay_flutter` wraps Razorpay's native
/// Standard Checkout SDKs and has no web implementation at all, so this
/// file must never be imported when compiling for web (see
/// razorpay_checkout.dart's conditional export).
class RazorpayCheckoutResult {
  const RazorpayCheckoutResult({required this.success, this.orderId, this.paymentId, this.signature, this.errorMessage});

  final bool success;
  final String? orderId;
  final String? paymentId;
  final String? signature;
  final String? errorMessage;
}

class RazorpayCheckoutController {
  Future<RazorpayCheckoutResult> open({
    required String keyId,
    required String orderId,
    required int amount,
    required String currency,
    required String description,
    String? prefillEmail,
    String? prefillContact,
  }) {
    final razorpay = Razorpay();
    final completer = Completer<RazorpayCheckoutResult>();

    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse response) {
      if (!completer.isCompleted) {
        completer.complete(RazorpayCheckoutResult(
          success: true,
          orderId: response.orderId,
          paymentId: response.paymentId,
          signature: response.signature,
        ));
      }
      razorpay.clear();
    });

    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse response) {
      if (!completer.isCompleted) {
        completer.complete(RazorpayCheckoutResult(success: false, errorMessage: response.message));
      }
      razorpay.clear();
    });

    razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse response) {
      // No-op — Razorpay handles the external wallet flow itself; we only
      // care about the final success/error callback.
    });

    razorpay.open({
      'key': keyId,
      'order_id': orderId,
      'amount': amount,
      'currency': currency,
      'name': 'Ziyam SelfDrive',
      'description': description,
      if (prefillEmail != null || prefillContact != null)
        'prefill': {
          'email': ?prefillEmail,
          'contact': ?prefillContact,
        },
    });

    return completer.future;
  }
}
