import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

class OpenWorkspaceView extends StatefulWidget {
  const OpenWorkspaceView({super.key});

  @override
  State<OpenWorkspaceView> createState() => _OpenWorkspaceViewState();
}

class _OpenWorkspaceViewState extends State<OpenWorkspaceView> {
  String? errorMessage;

  @override
  Widget build(BuildContext context) {
    Future<void> tryOpenWorkspace() async {
      var targetDirectory = await FilePicker.platform.getDirectoryPath();
      if (targetDirectory == null) return;
    }

    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: DefaultTabController(
        length: 2,
        animationDuration: Duration.zero,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Add a workspace',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: 30),
              ConstrainedBox(
                constraints:
                    const BoxConstraints(maxWidth: 400, maxHeight: 500),
                child: Column(
                  children: [
                    const TabBar(
                      tabs: [
                        Tab(text: "Local directory"),
                        Tab(text: "Cloud"),
                      ],
                    ),
                    Expanded(
                      child: TabBarView(
                        children: [
                          Column(
                            children: [
                              const SizedBox(height: 20),
                              Text(
                                errorMessage ?? "",
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                              const SizedBox(height: 100),
                              TextButton(
                                onPressed: tryOpenWorkspace,
                                child: const Text("Choose folder"),
                              ),
                            ],
                          ),
                          Center(
                            child: Text(
                              "Cloud connection is not yet supported.",
                              style: TextStyle(
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurface
                                    .withAlpha(150),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
