import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/providers.dart';
import '../shared/error_state.dart';

final _carDetailProvider = FutureProvider.autoDispose.family((ref, String carId) async {
  final repo = ref.watch(fleetRepositoryProvider);
  final car = await repo.getById(carId);
  final availability = await repo.availability(carId);
  return (car: car, availability: availability);
});

class CarDetailScreen extends ConsumerWidget {
  const CarDetailScreen({super.key, required this.carId});

  final String carId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(_carDetailProvider(carId));

    return Scaffold(
      appBar: AppBar(title: const Text('Car details')),
      body: state.when(
        loading: () => const LoadingState(),
        error: (err, _) => ErrorState(error: err, onRetry: () => ref.invalidate(_carDetailProvider(carId))),
        data: (data) {
          final car = data.car;
          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(car.displayName, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('${car.year} · ${car.category} · ${car.city}'),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    _Spec(icon: Icons.local_gas_station, label: car.fuelType),
                    _Spec(icon: Icons.settings, label: car.transmission),
                    _Spec(icon: Icons.people, label: '${car.seats} seats'),
                  ],
                ),
                const Divider(height: 32),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('₹${car.dailyRate.toStringAsFixed(0)}/day', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 20)),
                    Text('Deposit ₹${car.securityDeposit.toStringAsFixed(0)}', style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
                if (car.description != null) ...[
                  const SizedBox(height: 16),
                  Text(car.description!),
                ],
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => context.push('/cars/$carId/book'),
                    child: Text(car.instantBook ? 'Book instantly' : 'Request to book'),
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

class _Spec extends StatelessWidget {
  const _Spec({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 6),
        Text(label),
      ],
    );
  }
}
