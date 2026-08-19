import 'package:flutter/material.dart';

import '../../core/api_client.dart';

/// A consistent, non-crashing error/offline surface for every screen (FR-014)
/// — no screen should render a raw exception or an infinite spinner on
/// failure.
class ErrorState extends StatelessWidget {
  const ErrorState({super.key, required this.error, this.onRetry});

  final Object error;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    final isOffline = error is ApiException && (error as ApiException).isNetworkError;
    final message = error is ApiException ? (error as ApiException).message : 'Something went wrong.';
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(isOffline ? Icons.wifi_off : Icons.error_outline, size: 40, color: Theme.of(context).colorScheme.error),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            if (onRetry != null) ...[
              const SizedBox(height: 16),
              ElevatedButton(onPressed: onRetry, child: const Text('Try again')),
            ],
          ],
        ),
      ),
    );
  }
}

/// Shared loading spinner so every screen looks the same while waiting on
/// the network, instead of each screen inventing its own.
class LoadingState extends StatelessWidget {
  const LoadingState({super.key});

  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator());
}
