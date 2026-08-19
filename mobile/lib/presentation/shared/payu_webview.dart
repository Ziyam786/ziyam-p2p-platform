import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Mirrors `src/frontend`'s hidden auto-submitting HTML form POST
/// (`paymentGateway.ts:56-71`) inside an in-app WebView, rather than a
/// native PayU SDK — see specs/001-flutter-renter-app/contracts/rest-api.md's
/// Payment section and research.md's corresponding decision. Pops with
/// `true`/`false` when the redirect target contains "success"/"failure"
/// (matching `payuCallback.routes.ts`'s `surl`/`furl` redirect paths).
class PayuWebViewScreen extends StatefulWidget {
  const PayuWebViewScreen({super.key, required this.checkoutUrl, required this.fields});

  final String checkoutUrl;
  final Map<String, String> fields;

  @override
  State<PayuWebViewScreen> createState() => _PayuWebViewScreenState();
}

class _PayuWebViewScreenState extends State<PayuWebViewScreen> {
  late final WebViewController _controller;
  bool _resolved = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            _maybeResolve(request.url);
            return NavigationDecision.navigate;
          },
          onPageFinished: (url) => _maybeResolve(url),
        ),
      )
      ..loadRequest(
        Uri.parse(widget.checkoutUrl),
        method: LoadRequestMethod.post,
        headers: const {'Content-Type': 'application/x-www-form-urlencoded'},
        body: utf8.encode(Uri(queryParameters: widget.fields).query),
      );
  }

  void _maybeResolve(String url) {
    if (_resolved) return;
    final lower = url.toLowerCase();
    if (lower.contains('/payments/payu') && (lower.contains('success') || lower.contains('surl'))) {
      _resolved = true;
      Navigator.of(context).pop(true);
    } else if (lower.contains('/payments/payu') && (lower.contains('failure') || lower.contains('furl'))) {
      _resolved = true;
      Navigator.of(context).pop(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Secure payment'),
        leading: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop(false)),
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
