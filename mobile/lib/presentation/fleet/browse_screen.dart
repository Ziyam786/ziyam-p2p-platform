import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../../domain/fleet/car.dart';
import '../shared/app_bottom_nav.dart';
import '../shared/error_state.dart';

const _categories = ['All', 'Hatchback', 'Sedan', 'SUV', 'Luxury', 'EV', 'MUV'];

final _browseQueryProvider = StateProvider<String>((ref) => '');
final _browseCategoryProvider = StateProvider<String>((ref) => 'All');

final _fleetSearchProvider = FutureProvider.autoDispose<List<Car>>((ref) async {
  final repo = ref.watch(fleetRepositoryProvider);
  final category = ref.watch(_browseCategoryProvider);
  final query = ref.watch(_browseQueryProvider);
  return repo.search(category: category == 'All' ? null : category, query: query);
});

class BrowseScreen extends ConsumerWidget {
  const BrowseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cars = ref.watch(_fleetSearchProvider);
    final activeCategory = ref.watch(_browseCategoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Browse the fleet')),
      bottomNavigationBar: const AppBottomNav(currentPath: '/browse'),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: TextField(
              decoration: const InputDecoration(hintText: 'Search make, model, or city', prefixIcon: Icon(Icons.search)),
              onSubmitted: (v) => ref.read(_browseQueryProvider.notifier).state = v,
            ),
          ),
          SizedBox(
            height: 56,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              scrollDirection: Axis.horizontal,
              itemCount: _categories.length,
              separatorBuilder: (context, i) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final category = _categories[i];
                final selected = category == activeCategory;
                return ChoiceChip(
                  label: Text(category),
                  selected: selected,
                  onSelected: (_) => ref.read(_browseCategoryProvider.notifier).state = category,
                );
              },
            ),
          ),
          Expanded(
            child: cars.when(
              loading: () => const LoadingState(),
              error: (err, _) => ErrorState(error: err, onRetry: () => ref.invalidate(_fleetSearchProvider)),
              data: (list) => list.isEmpty
                  ? const Center(child: Text('No cars match right now — try another category or search.'))
                  : ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: list.length,
                      itemBuilder: (context, i) => _CarCard(car: list[i]),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CarCard extends StatelessWidget {
  const _CarCard({required this.car});

  final Car car;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => context.push('/cars/${car.id}'),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(car.displayName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text('${car.year} · ${car.city}', style: Theme.of(context).textTheme.bodySmall),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Text('₹${car.dailyRate.toStringAsFixed(0)}/day', style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(width: 8),
                        if (car.instantBook)
                          const Chip(label: Text('Instant Book', style: TextStyle(fontSize: 11)), visualDensity: VisualDensity.compact),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right),
            ],
          ),
        ),
      ),
    );
  }
}
