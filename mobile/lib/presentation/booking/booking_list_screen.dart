import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../domain/booking/booking.dart';
import '../shared/app_bottom_nav.dart';
import '../shared/error_state.dart';

final _myBookingsProvider = FutureProvider.autoDispose((ref) => ref.watch(bookingRepositoryProvider).myBookings());

class BookingListScreen extends ConsumerWidget {
  const BookingListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bookings = ref.watch(_myBookingsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your trips')),
      bottomNavigationBar: const AppBottomNav(currentPath: '/bookings'),
      body: bookings.when(
        loading: () => const LoadingState(),
        error: (err, _) => ErrorState(error: err, onRetry: () => ref.invalidate(_myBookingsProvider)),
        data: (list) => list.isEmpty
            ? const Center(child: Text('No trips yet — book a car to see it here.'))
            : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: list.length,
                itemBuilder: (context, i) {
                  final b = list[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      title: Text('₹${b.totalAmount.toStringAsFixed(0)} · ${_statusLabel(b.status)}'),
                      subtitle: Text('${b.startTime.toLocal().toString().split(' ').first} → ${b.endTime.toLocal().toString().split(' ').first}'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => context.push('/bookings/${b.id}'),
                    ),
                  );
                },
              ),
      ),
    );
  }

  String _statusLabel(BookingStatus status) {
    switch (status) {
      case BookingStatus.pending:
        return 'Pending';
      case BookingStatus.pendingPayment:
        return 'Payment pending';
      case BookingStatus.reserved:
        return 'Reserved — balance due';
      case BookingStatus.pendingHostReview:
        return 'Pending host approval';
      case BookingStatus.confirmed:
        return 'Confirmed';
      case BookingStatus.active:
        return 'Trip in progress';
      case BookingStatus.rejected:
        return 'Declined by host';
      case BookingStatus.cancelled:
        return 'Cancelled';
      case BookingStatus.completed:
        return 'Completed';
      case BookingStatus.unknown:
        return 'Unknown';
    }
  }
}
