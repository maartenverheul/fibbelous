import 'package:client/app.dart';
import 'package:client/globals.dart';
import 'package:client/providers/workspace_provider.dart';
import 'package:client/services/connection_service.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  getIt.registerSingleton<ConnectionService>(ConnectionService());

  var workspaceProvider = WorkspaceProvider();
  // await workspaceProvider.init();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (context) => workspaceProvider),
      ],
      child: const App(),
    ),
  );
}
