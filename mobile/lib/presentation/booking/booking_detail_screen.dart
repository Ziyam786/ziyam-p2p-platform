import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../shared/error_state.dart';

final _bookingDetailProvider =
    FutureProvider.autoDispose.family((ref, String bookingId) => ref.watch(bookingRepositoryProvider).getById(bookingId));

class BookingDetailScreen extends ConsumerWidget {
  const BookingDetailScreen({super.key, required this.bookingId});

  final String bookingId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final booking = ref.watch(_bookingDetailProvider(bookingId));
    return Scaffold(
      appBar: AppBar(title: const Text('Trip details')),
      body: booking.when(
        loading: () => const LoadingState(),
        error: (err, _) => ErrorState(error: err, onRetry: () => ref.invalidate(_bookingDetailProvider(bookingId))),
        data: (b) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('₹${b.totalAmount.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 22)),
              const SizedBox(height: 8),
              Text('${b.startTime.toLocal()} → ${b.endTime.toLocal()}'),
              const SizedBox(height: 16),
              Text('Protection plan: ${b.protectionPlan}'),
              if (b.coDriverRequested) Text('Co-driver: ${b.coDriverName ?? ''} (${b.maskedCoDriverLicense ?? ''})'),
            ],
          ),
        ),
      ),
    );
  }
}
