import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import javax.lang.model.element.*;
import javax.tools.*;
import com.sun.source.tree.*;
import com.sun.source.util.*;

// Parses and attributes source. No generate(), task.call(), processors, or project execution.
class MindTreeBindings {
  static String quote(String value) {
    StringBuilder result = new StringBuilder("\"");
    for (char c : value.toCharArray()) switch (c) {
      case '\\': result.append("\\\\"); break;
      case '"': result.append("\\\""); break;
      case '\n': result.append("\\n"); break;
      case '\r': result.append("\\r"); break;
      case '\t': result.append("\\t"); break;
      default: if (c < 32) result.append(String.format("\\u%04x", (int)c)); else result.append(c);
    }
    return result.append('"').toString();
  }
  public static void main(String[] args) throws Exception {
    JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
    if (compiler == null) throw new IllegalStateException("A JDK with compiler APIs is required.");
    List<Path> paths = new ArrayList<>();
    try (BufferedReader input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8))) {
      for (String line; (line = input.readLine()) != null;) paths.add(Path.of(new String(Base64.getDecoder().decode(line), StandardCharsets.UTF_8)));
    }
    DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
    try (StandardJavaFileManager manager = compiler.getStandardFileManager(diagnostics, null, StandardCharsets.UTF_8)) {
      JavacTask task = (JavacTask) compiler.getTask(null, manager, diagnostics, List.of("-proc:none", "-implicit:none", "-Xlint:none"), null, manager.getJavaFileObjectsFromPaths(paths));
      List<CompilationUnitTree> units = new ArrayList<>(); task.parse().forEach(units::add);
      task.analyze();
      Trees trees = Trees.instance(task); SourcePositions positions = trees.getSourcePositions();
      for (CompilationUnitTree unit : units) new TreePathScanner<Void, Void>() {
        void emit(TreePath reference, String evidence) {
          Element element = trees.getElement(reference);
          if (element == null) return;
          ElementKind kind = element.getKind();
          if (!(kind.isClass() || kind.isInterface() || kind == ElementKind.METHOD || kind == ElementKind.CONSTRUCTOR)) return;
          TreePath target = trees.getPath(element);
          if (target == null) return; // Library metadata is not a graph node.
          TreePath owner = reference;
          while (owner != null && !(owner.getLeaf() instanceof MethodTree) && !(owner.getLeaf() instanceof ClassTree)) owner = owner.getParentPath();
          long at = positions.getStartPosition(unit, reference.getLeaf());
          long from = owner == null ? -1 : positions.getStartPosition(unit, owner.getLeaf());
          long to = positions.getStartPosition(target.getCompilationUnit(), target.getLeaf());
          if (at < 0 || to < 0) return;
          String source = Path.of(unit.getSourceFile().toUri()).toString();
          String targetFile = Path.of(target.getCompilationUnit().getSourceFile().toUri()).toString();
          System.out.println("{\"file\":" + quote(source) + ",\"from\":" + from + ",\"at\":" + at + ",\"targetFile\":" + quote(targetFile) + ",\"target\":" + to + ",\"name\":" + quote(element.getSimpleName().toString()) + ",\"evidence\":" + quote(evidence) + "}");
        }
        @Override public Void visitMethodInvocation(MethodInvocationTree node, Void value) { emit(getCurrentPath(), "call"); return super.visitMethodInvocation(node, value); }
        @Override public Void visitNewClass(NewClassTree node, Void value) { emit(getCurrentPath(), "construct"); return super.visitNewClass(node, value); }
        @Override public Void visitIdentifier(IdentifierTree node, Void value) { emit(getCurrentPath(), "type-or-value"); return super.visitIdentifier(node, value); }
        @Override public Void visitClass(ClassTree node, Void value) {
          for (Tree implemented : node.getImplementsClause()) emit(new TreePath(getCurrentPath(), implemented), "implements");
          if (node.getExtendsClause() != null) emit(new TreePath(getCurrentPath(), node.getExtendsClause()), "extends");
          return super.visitClass(node, value);
        }
      }.scan(unit, null);
      for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics.getDiagnostics()) if (diagnostic.getKind() == Diagnostic.Kind.ERROR) {
        String file = diagnostic.getSource() == null ? "" : Path.of(diagnostic.getSource().toUri()).toString();
        System.out.println("{\"diagnostic\":true,\"file\":" + quote(file) + ",\"line\":" + diagnostic.getLineNumber() + ",\"message\":" + quote(diagnostic.getMessage(Locale.ROOT)) + "}");
      }
    }
  }
}
