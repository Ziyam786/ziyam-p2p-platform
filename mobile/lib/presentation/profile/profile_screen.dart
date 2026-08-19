import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api_client.dart';
import '../../core/providers.dart';
import '../shared/app_bottom_nav.dart';
import '../shared/error_state.dart';

final _profileProvider = FutureProvider.autoDispose((ref) => ref.watch(profileRepositoryProvider).getMe());

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  bool _saving = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(_profileProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.verified_user_outlined),
            tooltip: 'KYC status',
            onPressed: () => context.push('/profile/kyc'),
          ),
        ],
      ),
      bottomNavigationBar: const AppBottomNav(currentPath: '/profile'),
      body: profile.when(
        loading: () => const LoadingState(),
        error: (err, _) => ErrorState(error: err, onRetry: () => ref.invalidate(_profileProvider)),
        data: (user) {
          final fullName = TextEditingController(text: user.fullName);
          final phone = TextEditingController(text: user.phoneNumber);
          final bio = TextEditingController(text: user.bio ?? '');
          return Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(user.email, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 20),
                TextField(controller: fullName, decoration: const InputDecoration(labelText: 'Full name')),
                const SizedBox(height: 12),
                TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone number')),
                const SizedBox(height: 12),
                TextField(controller: bio, decoration: const InputDecoration(labelText: 'Bio')),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ],
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: _saving
                      ? null
                      : () async {
                          setState(() {
                            _saving = true;
                            _error = null;
                          });
                          try {
                            await ref.read(profileRepositoryProvider).updateMe(
                                  fullName: fullName.text.trim(),
                                  phoneNumber: phone.text.trim(),
                                  bio: bio.text.trim(),
                                );
                            ref.invalidate(_profileProvider);
                          } on ApiException catch (e) {
                            setState(() => _error = e.message);
                          } finally {
                            if (mounted) setState(() => _saving = false);
                          }
                        },
                  child: _saving
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Save'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () async {
                    await ref.read(authRepositoryProvider).logout();
                    ref.read(currentUserProvider.notifier).state = null;
                    if (context.mounted) context.go('/login');
                  },
                  child: const Text('Log out'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
