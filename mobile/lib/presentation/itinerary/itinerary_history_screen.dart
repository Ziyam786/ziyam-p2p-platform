import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/itinerary/itinerary_history_store.dart';

final _historyProvider = FutureProvider.autoDispose((ref) => ItineraryHistoryStore().read());

/// Past itineraries this device has unlocked — see ItineraryHistoryStore
/// and research.md's note that ItineraryUnlock is id-scoped, not
/// user-linked, so "reopen a past purchase" has to be device-local.
class ItineraryHistoryScreen extends ConsumerWidget {
  const ItineraryHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(_historyProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your itineraries')),
      body: history.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, _) => Center(child: Text('$err')),
        data: (ids) => ids.isEmpty
            ? const Center(child: Text('No itineraries unlocked yet on this device.'))
            : ListView.builder(
                itemCount: ids.length,
                itemBuilder: (context, i) => ListTile(
                  title: Text('Itinerary ${ids[i].substring(0, 8)}…'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/itineraries/${ids[i]}'),
                ),
              ),
      ),
    );
  }
}
