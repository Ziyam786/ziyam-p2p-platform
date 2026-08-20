import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../data/itinerary/itinerary_history_store.dart';
import '../../domain/itinerary/itinerary_unlock.dart';
import '../shared/error_state.dart';

final _itineraryHistoryStoreProvider = Provider((ref) => ItineraryHistoryStore());

/// Loads the unlock. Generation is server-side now (see
/// itinerary_repository.dart's doc comment) — by the time payment is
/// verified, `razorpayPaymentHandler.ts` has already generated and stored
/// the content, so this just fetches and displays it. A short poll covers
/// the (normally sub-second) gap between the verify call returning and the
/// webhook/verify write actually landing.
final _itineraryProvider = FutureProvider.autoDispose.family((ref, String id) async {
  final repo = ref.watch(itineraryRepositoryProvider);
  var unlock = await repo.getById(id);

  for (var attempt = 0; attempt < 5 && unlock.status == ItineraryUnlockStatus.paid && !unlock.hasRealContent; attempt++) {
    await Future.delayed(const Duration(seconds: 2));
    unlock = await repo.getById(id);
  }

  if (unlock.status == ItineraryUnlockStatus.paid) {
    await ref.watch(_itineraryHistoryStoreProvider).add(id);
  }

  return unlock;
});

class ItineraryViewScreen extends ConsumerWidget {
  const ItineraryViewScreen({super.key, required this.itineraryId});

  final String itineraryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itinerary = ref.watch(_itineraryProvider(itineraryId));
    return Scaffold(
      appBar: AppBar(title: const Text('Your itinerary')),
      body: itinerary.when(
        loading: () => const _GeneratingState(),
        error: (err, _) => ErrorState(error: err, onRetry: () => ref.invalidate(_itineraryProvider(itineraryId))),
        data: (unlock) {
          if (unlock.status != ItineraryUnlockStatus.paid) {
            return const Center(child: Text('This itinerary has not been paid for yet.'));
          }
          if (!unlock.hasRealContent) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text('Generation is taking longer than expected.'),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () => ref.invalidate(_itineraryProvider(itineraryId)),
                      child: const Text('Check again'),
                    ),
                  ],
                ),
              ),
            );
          }
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(unlock.destination, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
                const SizedBox(height: 16),
                Text(unlock.generatedContent ?? ''),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _GeneratingState extends StatelessWidget {
  const _GeneratingState();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(),
          SizedBox(height: 16),
          Text('Writing your itinerary…'),
        ],
      ),
    );
  }
}
