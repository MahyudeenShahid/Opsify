import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

void main() {
  runApp(const OpsifyApp());
}

class OpsifyApp extends StatelessWidget {
  const OpsifyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Opsify AI',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.teal),
        useMaterial3: true,
      ),
      home: const CustomerBrainScreen(),
    );
  }
}

class CustomerBrainScreen extends StatefulWidget {
  const CustomerBrainScreen({super.key});

  @override
  State<CustomerBrainScreen> createState() => _CustomerBrainScreenState();
}

class _CustomerBrainScreenState extends State<CustomerBrainScreen> {
  final TextEditingController _messageController = TextEditingController();
  bool _isLoading = false;
  List<String> _traceLogs = [];
  String _status = '';
  Map<String, dynamic>? _selectedProvider;

  Future<void> _sendOrder() async {
    if (_messageController.text.isEmpty) return;

    setState(() {
      _isLoading = true;
      _traceLogs = [];
      _status = 'Running Antigravity Graph...';
      _selectedProvider = null;
    });

    try {
      // Connect to local FastAPI server (use 10.0.2.2 for Android emulator)
      // For Windows desktop or web, use localhost or 127.0.0.1
      final url = Uri.parse('http://127.0.0.1:8000/api/orchestrate');
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'message': _messageController.text}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _status = data['execution_status'];
          _traceLogs = List<String>.from(data['trace_logs']);
          _selectedProvider = data['provider'];
        });
      } else {
        setState(() {
          _status = 'Failed: \${response.statusCode}';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error: \$e';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Opsify: Customer Brain'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            TextField(
              controller: _messageController,
              decoration: InputDecoration(
                labelText: 'Enter Customer Request (Urdu/English)',
                hintText: 'e.g. Kal Gulshan mein ek electrician bhej do',
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.send),
                  onPressed: _isLoading ? null : _sendOrder,
                ),
              ),
              onSubmitted: (_) {
                if (!_isLoading) _sendOrder();
              },
            ),
            const SizedBox(height: 20),
            if (_isLoading) const CircularProgressIndicator(),
            if (_status.isNotEmpty)
              Text(
                'Status: \$_status',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
            const SizedBox(height: 10),
            if (_selectedProvider != null && _selectedProvider!.isNotEmpty)
              Card(
                color: Colors.teal.shade50,
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('✅ Booked: \${_selectedProvider!["name"]}', 
                           style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text('Rating: \${_selectedProvider!["rating"]} ★ | Rs \${_selectedProvider!["price_per_hr"]}/hr'),
                      const SizedBox(height: 8),
                      Text('AI Reasoning: \${_selectedProvider!["reasoning_string"]}', 
                           style: const TextStyle(fontStyle: FontStyle.italic)),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: 20),
            const Align(
              alignment: Alignment.centerLeft,
              child: Text(
                'Antigravity Agent Trace Logs:',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(8.0),
                decoration: BoxDecoration(
                  color: Colors.black87,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: ListView.builder(
                  itemCount: _traceLogs.length,
                  itemBuilder: (context, index) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4.0),
                      child: Text(
                        _traceLogs[index],
                        style: const TextStyle(color: Colors.greenAccent, fontFamily: 'monospace', fontSize: 12),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
