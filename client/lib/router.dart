import 'package:client/views/new_workspace_view.dart';
import 'package:client/views/open_workspace_view.dart';
import 'package:client/views/main_view.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

String? checkMainRoute(BuildContext context, GoRouterState state) {
  if (true) return '/workspace/add';
}

final router = GoRouter(
  routes: [
    GoRoute(
      name: 'home',
      path: '/',
      builder: (context, state) => const MainView(),
      redirect: checkMainRoute,
    ),
    GoRoute(
      name: 'addWorkspace',
      path: '/workspace/add',
      builder: (context, state) => const OpenWorkspaceView(),
    ),
    GoRoute(
      name: 'newWorkspace',
      path: '/workspace/new',
      builder: (context, state) => const NewWorkspaceView(),
    ),
    GoRoute(
      name: 'existingWorkspace',
      path: '/workspace/:workspaceIndex',
      builder: (context, state) => const MainView(),
      // redirect: checkMainRoute,
    ),
  ],
);
