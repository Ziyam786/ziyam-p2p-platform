import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../shared/error_state.dart';
import '../shared/payu_webview.dart';

class BookingCheckoutScreen extends ConsumerStatefulWidget {
  const BookingCheckoutScreen({super.key, required this.carId});

  final String carId;

  @override
  ConsumerState<BookingCheckoutScreen> createState() => _BookingCheckoutScreenState();
}

class _BookingCheckoutScreenState extends ConsumerState<BookingCheckoutScreen> {
  DateTime? _start;
  DateTime? _end;
  bool _submitting = false;
  String? _error;
  String? _errorCode;

  double _estimatedTotal(double dailyRate) {
    if (_start == null || _end == null) return 0;
    final days = _end!.difference(_start!).inHours / 24;
    return (days.ceil().clamp(1, 365)) * dailyRate;
  }

  Future<void> _pickRange() async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (range != null) {
      setState(() {
        _start = range.start;
        _end = range.end.add(const Duration(hours: 23));
      });
    }
  }

  Future<void> _confirmAndPay(double dailyRate) async {
    if (_start == null || _end == null) return;
    setState(() {
      _submitting = true;
      _error = null;
      _errorCode = null;
    });
    try {
      final bookingRepo = ref.read(bookingRepositoryProvider);
      final bookingId = await bookingRepo.create(
        carId: widget.carId,
        startTime: _start!,
        endTime: _end!,
        totalAmount: _estimatedTotal(dailyRate),
      );
      final checkout = await bookingRepo.checkoutSession(bookingId);
      if (!mounted) return;
      final paid = await Navigator.of(context).push<bool>(
        MaterialPageRoute(builder: (_) => PayuWebViewScreen(checkoutUrl: checkout.url, fields: checkout.fields)),
      );
      if (!mounted) return;
      if (paid == true) {
        context.go('/bookings/$bookingId');
      } else {
        setState(() => _error = 'Payment was not completed. Your dates have not been confirmed.');
      }
    } on ApiException catch (e) {
      setState(() {
        _error = e.message;
        _errorCode = e.code;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final carAsync = ref.watch(fleetRepositoryProvider).getById(widget.carId);
    return Scaffold(
      appBar: AppBar(title: const Text('Book this car')),
      body: FutureBuilder(
        future: carAsync,
        builder: (context, snapshot) {
          if (!snapshot.hasData && !snapshot.hasError) return const LoadingState();
          if (snapshot.hasError) return ErrorState(error: snapshot.error!);
          final car = snapshot.data!;
          final total = _estimatedTotal(car.dailyRate);
          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(car.displayName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _pickRange,
                  icon: const Icon(Icons.calendar_today),
                  label: Text(_start == null
                      ? 'Select pickup & drop-off dates'
                      : '${_start!.toLocal().toString().split(' ').first} → ${_end!.toLocal().toString().split(' ').first}'),
                ),
                const SizedBox(height: 24),
                if (_start != null) ...[
                  _PriceRow(label: 'Estimated total', value: '₹${total.toStringAsFixed(0)}'),
                  _PriceRow(label: 'Security deposit (held, not charged now)', value: '₹${car.securityDeposit.toStringAsFixed(0)}'),
                ],
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  if (_errorCode == 'KYC_REQUIRED')
                    TextButton(onPressed: () => context.push('/profile/kyc'), child: const Text('Complete KYC verification')),
                  if (_errorCode == 'DRIVING_LICENSE_REQUIRED')
                    TextButton(onPressed: () => context.push('/profile/kyc'), child: const Text('Verify your driving licence')),
                ],
                const Spacer(),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: (_start == null || _submitting) ? null : () => _confirmAndPay(car.dailyRate),
                    child: _submitting
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Confirm & pay'),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Expanded(child: Text(label)), Text(value, style: const TextStyle(fontWeight: FontWeight.w700))],
      ),
    );
  }
}
