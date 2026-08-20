import '../../core/api_client.dart';

/// Shared by both booking and itinerary flows — mirrors
/// `POST /payments/razorpay/verify` (`razorpayVerify.routes.ts`), the fast
/// client-invoked confirmation path that runs right after Razorpay
/// Checkout's success handler fires. The webhook
/// (`razorpayWebhook.routes.ts`) is the authoritative backstop if this call
/// never happens (app killed right after paying) — this call exists purely
/// to give the UI immediate feedback instead of waiting on the webhook.
class RazorpayVerifyResult {
  const RazorpayVerifyResult({required this.success, required this.kind, required this.entityId});

  final bool success;
  final String? kind;
  final String? entityId;
}

Future<RazorpayVerifyResult> verifyRazorpayPayment(
  ApiClient api, {
  required String orderId,
  required String paymentId,
  required String signature,
}) async {
  final response = await api.post<Map<String, dynamic>>('/payments/razorpay/verify', data: {
    'razorpay_order_id': orderId,
    'razorpay_payment_id': paymentId,
    'razorpay_signature': signature,
  });
  final body = response.data!;
  return RazorpayVerifyResult(
    success: body['success'] as bool? ?? false,
    kind: body['kind'] as String?,
    entityId: body['entityId'] as String?,
  );
}
