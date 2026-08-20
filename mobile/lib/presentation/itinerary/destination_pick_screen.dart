import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../../data/payments/razorpay_verify.dart';
import '../../domain/itinerary/itinerary_unlock.dart';
import '../shared/app_bottom_nav.dart';
import '../shared/razorpay_checkout.dart';

class DestinationPickScreen extends ConsumerStatefulWidget {
  const DestinationPickScreen({super.key});

  @override
  ConsumerState<DestinationPickScreen> createState() => _DestinationPickScreenState();
}

class _DestinationPickScreenState extends ConsumerState<DestinationPickScreen> {
  bool _submitting = false;
  String? _error;

  Future<void> _unlock(String destination) async {
    final user = ref.read(currentUserProvider);
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final repo = ref.read(itineraryRepositoryProvider);
      final result = await repo.unlock(
        destination: destination,
        customerName: user?.fullName ?? '',
        customerEmail: user?.email ?? '',
        customerPhone: user?.phoneNumber ?? '',
      );
      final checkoutResult = await RazorpayCheckoutController().open(
        keyId: result.checkout.keyId,
        orderId: result.checkout.orderId,
        amount: result.checkout.amount,
        currency: result.checkout.currency,
        description: 'Road-trip itinerary — $destination',
        prefillEmail: user?.email,
        prefillContact: user?.phoneNumber,
      );
      if (!mounted) return;
      if (!checkoutResult.success ||
          checkoutResult.orderId == null ||
          checkoutResult.paymentId == null ||
          checkoutResult.signature == null) {
        setState(() => _error = checkoutResult.errorMessage ?? 'Payment was not completed — your itinerary was not unlocked.');
        return;
      }
      final verified = await verifyRazorpayPayment(
        ref.read(apiClientProvider),
        orderId: checkoutResult.orderId!,
        paymentId: checkoutResult.paymentId!,
        signature: checkoutResult.signature!,
      );
      if (!mounted) return;
      if (verified.success) {
        context.go('/itineraries/${result.id}');
      } else {
        setState(() => _error = 'Payment could not be verified — please contact support before retrying.');
      }
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Plan a road trip'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Your itineraries',
            onPressed: () => context.push('/itineraries/history'),
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentPath: '/itineraries'),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Pick a destination for a personalized, AI-written road-trip itinerary — ₹49.'),
            const SizedBox(height: 20),
            if (_error != null) ...[
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
              const SizedBox(height: 12),
            ],
            Expanded(
              child: ListView(
                children: itineraryDestinations.entries
                    .map(
                      (entry) => Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          title: Text(entry.key, style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text(entry.value),
                          trailing: _submitting ? null : const Icon(Icons.chevron_right),
                          onTap: _submitting ? null : () => _unlock(entry.key),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
