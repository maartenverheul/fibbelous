class Page {
  Page({
    required this.id,
    required this.title,
    required this.icon,
    required this.content,
    required this.createdAt,
    this.children = const [],
  });

  final String id;
  final String title;
  final String icon;
  final String content;
  final DateTime createdAt;
  final List<Page> children;
}
