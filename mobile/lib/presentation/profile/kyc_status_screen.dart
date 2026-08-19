import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../shared/error_state.dart';

final _kycProfileProvider = FutureProvider.autoDispose((ref) => ref.watch(profileRepositoryProvider).getMe());

/// Shows only the derived KYC verification state — never a raw document
/// number or `kycDocUrl` (constitution Principle II; `ZiyamUser` has no
/// field for either, so there is nothing here that could accidentally
/// render one).
class KycStatusScreen extends ConsumerWidget {
  const KycStatusScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(_kycProfileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('KYC & driving licence status')),
      body: profile.when(
        loading: () => const LoadingState(),
        error: (err, _) => ErrorState(error: err, onRetry: () => ref.invalidate(_kycProfileProvider)),
        data: (user) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StatusRow(label: 'Identity (KYC)', verified: user.isKycVerified),
              const SizedBox(height: 12),
              _StatusRow(label: 'Driving licence', verified: user.isDrivingLicenseVerified),
              const SizedBox(height: 24),
              if (!user.isKycVerified || !user.isDrivingLicenseVerified)
                const Text(
                  'Both must be verified before you can book a car (see the Ziyam web app or '
                  'support to complete verification — document upload is not yet available in '
                  'this app).',
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({required this.label, required this.verified});

  final String label;
  final bool verified;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          verified ? Icons.check_circle : Icons.hourglass_empty,
          color: verified ? Colors.green : Colors.orange,
        ),
        const SizedBox(width: 12),
        Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
        const Spacer(),
        Text(verified ? 'Verified' : 'Pending'),
      ],
    );
  }
}
