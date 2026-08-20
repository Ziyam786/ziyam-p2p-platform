// ignore_for_file: non_constant_identifier_names
// (external JS interop fields below must match Razorpay's actual
// snake_case property/option names exactly — e.g. `razorpay_order_id`,
// `order_id` — not a style choice.)
import 'dart:async';
import 'dart:js_interop';

/// Web implementation — `razorpay_flutter` (the mobile package) has no web
/// build, so this calls Razorpay's own web SDK (Checkout.js, loaded via
/// `web/index.html`'s `<script src="https://checkout.razorpay.com/v1/checkout.js">`)
/// directly through `dart:js_interop` (the modern, non-deprecated
/// interop API — `dart:js`/`dart:js_util` have been removed from this SDK).
/// Same public API as `razorpay_checkout_io.dart` so calling screens never
/// branch on platform — see razorpay_checkout.dart's conditional export.
class RazorpayCheckoutResult {
  const RazorpayCheckoutResult({required this.success, this.orderId, this.paymentId, this.signature, this.errorMessage});

  final bool success;
  final String? orderId;
  final String? paymentId;
  final String? signature;
  final String? errorMessage;
}

extension type _Prefill._(JSObject _) implements JSObject {
  external factory _Prefill({String? email, String? contact});
}

extension type _Modal._(JSObject _) implements JSObject {
  external factory _Modal({JSFunction? ondismiss});
}

extension type _RazorpayOptions._(JSObject _) implements JSObject {
  external factory _RazorpayOptions({
    required String key,
    required int amount,
    required String currency,
    required String name,
    required String description,
    required String order_id,
    required JSFunction handler,
    _Prefill? prefill,
    _Modal? modal,
  });
}

extension type _PaymentSuccessResponse._(JSObject _) implements JSObject {
  external String? get razorpay_order_id;
  external String? get razorpay_payment_id;
  external String? get razorpay_signature;
}

extension type _RazorpayError._(JSObject _) implements JSObject {
  external String? get description;
}

extension type _PaymentFailedResponse._(JSObject _) implements JSObject {
  external _RazorpayError? get error;
}

@JS('Razorpay')
extension type _JsRazorpay._(JSObject _) implements JSObject {
  external factory _JsRazorpay(_RazorpayOptions options);
  external void open();
  external void on(String event, JSFunction handler);
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
    final completer = Completer<RazorpayCheckoutResult>();

    void handleSuccess(_PaymentSuccessResponse response) {
      if (completer.isCompleted) return;
      completer.complete(RazorpayCheckoutResult(
        success: true,
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      ));
    }

    void handleDismiss() {
      if (completer.isCompleted) return;
      completer.complete(const RazorpayCheckoutResult(success: false, errorMessage: 'Payment window closed.'));
    }

    // Fires on an actual failed payment attempt (card declined, etc.) — a
    // distinct path from the guest just closing the modal (above).
    void handleFailure(_PaymentFailedResponse response) {
      if (completer.isCompleted) return;
      completer.complete(RazorpayCheckoutResult(success: false, errorMessage: response.error?.description ?? 'Payment failed.'));
    }

    final options = _RazorpayOptions(
      key: keyId,
      amount: amount,
      currency: currency,
      name: 'Ziyam SelfDrive',
      description: description,
      order_id: orderId,
      handler: handleSuccess.toJS,
      prefill: (prefillEmail != null || prefillContact != null)
          ? _Prefill(email: prefillEmail, contact: prefillContact)
          : null,
      modal: _Modal(ondismiss: handleDismiss.toJS),
    );

    final instance = _JsRazorpay(options);
    instance.on('payment.failed', handleFailure.toJS);
    instance.open();

    return completer.future;
  }
}
