import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../data/itinerary/itinerary_ai_service.dart';
import '../../data/itinerary/itinerary_history_store.dart';
import '../../domain/itinerary/itinerary_unlock.dart';
import '../shared/error_state.dart';

final _itineraryHistoryStoreProvider = Provider((ref) => ItineraryHistoryStore());
final _itineraryAiServiceProvider = Provider((ref) => ItineraryAiService());

/// Loads the unlock, generates content client-side via Firebase AI Logic if
/// payment has landed but generation hasn't happened yet (FR-009/FR-010),
/// and remembers the id locally so it can be reopened without re-paying.
final _itineraryProvider = FutureProvider.autoDispose.family((ref, String id) async {
  final repo = ref.watch(itineraryRepositoryProvider);
  var unlock = await repo.getById(id);

  if (unlock.status == ItineraryUnlockStatus.paid && !unlock.hasRealContent) {
    final ai = ref.watch(_itineraryAiServiceProvider);
    final content = await ai.generate(unlock.destination);
    unlock = await repo.submitContent(id, content);
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
