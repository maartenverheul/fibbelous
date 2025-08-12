import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class NewWorkspaceView extends StatefulWidget {
  const NewWorkspaceView({super.key});

  @override
  State<NewWorkspaceView> createState() => _NewWorkspaceViewState();
}

class _NewWorkspaceViewState extends State<NewWorkspaceView> {
  String? errorMessage;

  @override
  Widget build(BuildContext context) {
    final extra = GoRouterState.of(context).extra as Map<String, dynamic>;
    final targetDirectory = extra['directory'] as String;

    Future<void> createWorkspace() async {
      // await WorkspaceService.init(targetDirectory);

      context.goNamed(
        "existingWorkspace",
        pathParameters: {
          "workspaceIndex": "1",
        },
      );
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
                'New workspace',
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              Text(
                targetDirectory,
                style: Theme.of(context).textTheme.labelMedium,
              ),
              const SizedBox(height: 100),
              TextButton(
                onPressed: createWorkspace,
                child: const Text("Create workspace"),
              )
            ],
          ),
        ),
      ),
    );
  }
}
