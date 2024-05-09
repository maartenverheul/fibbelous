import git, { CallbackFsClient, PromiseFsClient } from "isomorphic-git";
import http from "isomorphic-git/http/node";

type O<T> = Omit<T, "fs" | "http" | "dir">;

export class GitClient {

  constructor(private readonly fs: CallbackFsClient | PromiseFsClient, private readonly dir: string) {}

  add(args: O<Parameters<typeof git.add>[0]>) { return git.add({ ...args, fs: this.fs, dir: this.dir }); }
  abortMerge(args: O<Parameters<typeof git.abortMerge>[0]>) { return git.abortMerge({ ...args, fs: this.fs, dir: this.dir }); }
  addNote(args: O<Parameters<typeof git.addNote>[0]>) { return git.addNote({ ...args, fs: this.fs, dir: this.dir }); }
  addRemote(args: O<Parameters<typeof git.addRemote>[0]>) { return git.addRemote({ ...args, fs: this.fs, dir: this.dir }); }
  annotatedTag(args: O<Parameters<typeof git.annotatedTag>[0]>) { return git.annotatedTag({ ...args, fs: this.fs, dir: this.dir }); }
  branch(args: O<Parameters<typeof git.branch>[0]>) { return git.branch({ ...args, fs: this.fs, dir: this.dir }); }
  checkout(args: O<Parameters<typeof git.checkout>[0]>) { return git.checkout({ ...args, fs: this.fs, dir: this.dir }); }
  clone(args: O<Parameters<typeof git.clone>[0]>) { return git.clone({ ...args, fs: this.fs, dir: this.dir, http }); }
  commit(args: O<Parameters<typeof git.commit>[0]>) { return git.commit({ ...args, fs: this.fs, dir: this.dir }); }
  getConfig(args: O<Parameters<typeof git.getConfig>[0]>) { return git.getConfig({ ...args, fs: this.fs, dir: this.dir }); }
  getConfigAll(args: O<Parameters<typeof git.getConfigAll>[0]>) { return git.getConfigAll({ ...args, fs: this.fs, dir: this.dir }); }
  setConfig(args: O<Parameters<typeof git.setConfig>[0]>) { return git.setConfig({ ...args, fs: this.fs, dir: this.dir }); }
  currentBranch(args: O<Parameters<typeof git.currentBranch>[0]>) { return git.currentBranch({ ...args, fs: this.fs, dir: this.dir }); }
  deleteBranch(args: O<Parameters<typeof git.deleteBranch>[0]>) { return git.deleteBranch({ ...args, fs: this.fs, dir: this.dir }); }
  deleteRef(args: O<Parameters<typeof git.deleteRef>[0]>) { return git.deleteRef({ ...args, fs: this.fs, dir: this.dir }); }
  deleteRemote(args: O<Parameters<typeof git.deleteRemote>[0]>) { return git.deleteRemote({ ...args, fs: this.fs, dir: this.dir }); }
  deleteTag(args: O<Parameters<typeof git.deleteTag>[0]>) { return git.deleteTag({ ...args, fs: this.fs, dir: this.dir }); }
  expandOid(args: O<Parameters<typeof git.expandOid>[0]>) { return git.expandOid({ ...args, fs: this.fs, dir: this.dir }); }
  expandRef(args: O<Parameters<typeof git.expandRef>[0]>) { return git.expandRef({ ...args, fs: this.fs, dir: this.dir }); }
  fastForward(args: O<Parameters<typeof git.fastForward>[0]>) { return git.fastForward({ ...args, fs: this.fs, dir: this.dir, http }); }
  fetch(args: O<Parameters<typeof git.fetch>[0]>) { return git.fetch({ ...args, fs: this.fs, dir: this.dir, http }); }
  findMergeBase(args: O<Parameters<typeof git.findMergeBase>[0]>) { return git.findMergeBase({ ...args, fs: this.fs, dir: this.dir }); }
  findRoot(args: O<Parameters<typeof git.findRoot>[0]>) { return git.findRoot({ ...args, fs: this.fs }); }
  getRemoteInfo(args: O<Parameters<typeof git.getRemoteInfo>[0]>) { return git.getRemoteInfo({ ...args, http  }); }
  getRemoteInfo2(args: O<Parameters<typeof git.getRemoteInfo2>[0]>) { return git.getRemoteInfo2({ ...args, http }); }
  hashBlob(args: O<Parameters<typeof git.hashBlob>[0]>) { return git.hashBlob({ ...args }); }
  indexPack(args: O<Parameters<typeof git.indexPack>[0]>) { return git.indexPack({ ...args, fs: this.fs, dir: this.dir }); }
  init(args: O<Parameters<typeof git.init>[0]>) { return git.init({ ...args, fs: this.fs, dir: this.dir }); }
  isDescendent(args: O<Parameters<typeof git.isDescendent>[0]>) { return git.isDescendent({ ...args, fs: this.fs, dir: this.dir }); }
  isIgnored(args: O<Parameters<typeof git.isIgnored>[0]>) { return git.isIgnored({ ...args, fs: this.fs, dir: this.dir }); }
  listBranches(args: O<Parameters<typeof git.listBranches>[0]>) { return git.listBranches({ ...args, fs: this.fs, dir: this.dir }); }
  listFiles(args: O<Parameters<typeof git.listFiles>[0]>) { return git.listFiles({ ...args, fs: this.fs, dir: this.dir }); }
  listNotes(args: O<Parameters<typeof git.listNotes>[0]>) { return git.listNotes({ ...args, fs: this.fs, dir: this.dir }); }
  listRemotes(args: O<Parameters<typeof git.listRemotes>[0]>) { return git.listRemotes({ ...args, fs: this.fs, dir: this.dir }); }
  listServerRefs(args: O<Parameters<typeof git.listServerRefs>[0]>) { return git.listServerRefs({ ...args, http }); }
  listTags(args: O<Parameters<typeof git.listTags>[0]>) { return git.listTags({ ...args, fs: this.fs, dir: this.dir }); }
  log(args: O<Parameters<typeof git.log>[0]>) { return git.log({ ...args, fs: this.fs, dir: this.dir }); }
  merge(args: O<Parameters<typeof git.merge>[0]>) { return git.merge({ ...args, fs: this.fs, dir: this.dir }); }
  packObjects(args: O<Parameters<typeof git.packObjects>[0]>) { return git.packObjects({ ...args, fs: this.fs, dir: this.dir }); }
  pull(args: O<Parameters<typeof git.pull>[0]>) { return git.pull({ ...args, fs: this.fs, dir: this.dir, http }); }
  push(args: O<Parameters<typeof git.push>[0]>) { return git.push({ ...args, fs: this.fs, dir: this.dir, http }); }
  readBlob(args: O<Parameters<typeof git.readBlob>[0]>) { return git.readBlob({ ...args, fs: this.fs, dir: this.dir }); }
  readCommit(args: O<Parameters<typeof git.readCommit>[0]>) { return git.readCommit({ ...args, fs: this.fs, dir: this.dir }); }
  readNote(args: O<Parameters<typeof git.readNote>[0]>) { return git.readNote({ ...args, fs: this.fs, dir: this.dir }); }
  readTag(args: O<Parameters<typeof git.readTag>[0]>) { return git.readTag({ ...args, fs: this.fs, dir: this.dir }); }
  readTree(args: O<Parameters<typeof git.readTree>[0]>) { return git.readTree({ ...args, fs: this.fs, dir: this.dir }); }
  remove(args: O<Parameters<typeof git.remove>[0]>) { return git.remove({ ...args, fs: this.fs, dir: this.dir }); }
  removeNote(args: O<Parameters<typeof git.removeNote>[0]>) { return git.removeNote({ ...args, fs: this.fs, dir: this.dir }); }
  renameBranch(args: O<Parameters<typeof git.renameBranch>[0]>) { return git.renameBranch({ ...args, fs: this.fs, dir: this.dir }); }
  resetIndex(args: O<Parameters<typeof git.resetIndex>[0]>) { return git.resetIndex({ ...args, fs: this.fs, dir: this.dir }); }
  updateIndex(args: O<Parameters<typeof git.updateIndex>[0]>) { return git.updateIndex({ ...args, fs: this.fs, dir: this.dir }); }
  resolveRef(args: O<Parameters<typeof git.resolveRef>[0]>) { return git.resolveRef({ ...args, fs: this.fs, dir: this.dir }); }
  status(args: O<Parameters<typeof git.status>[0]>) { return git.status({ ...args, fs: this.fs, dir: this.dir }); }
  statusMatrix(args: O<Parameters<typeof git.statusMatrix>[0]>) { return git.statusMatrix({ ...args, fs: this.fs, dir: this.dir }); }
  tag(args: O<Parameters<typeof git.tag>[0]>) { return git.tag({ ...args, fs: this.fs, dir: this.dir }); }
  version() { git.version(); }
  walk(args: O<Parameters<typeof git.walk>[0]>) { return git.walk({ ...args, fs: this.fs, dir: this.dir }); }
  writeBlob(args: O<Parameters<typeof git.writeBlob>[0]>) { return git.writeBlob({ ...args, fs: this.fs, dir: this.dir }); }
  writeCommit(args: O<Parameters<typeof git.writeCommit>[0]>) { return git.writeCommit({ ...args, fs: this.fs, dir: this.dir }); }
  writeRef(args: O<Parameters<typeof git.writeRef>[0]>) { return git.writeRef({ ...args, fs: this.fs, dir: this.dir }); }
  writeTag(args: O<Parameters<typeof git.writeTag>[0]>) { return git.writeTag({ ...args, fs: this.fs, dir: this.dir }); }
  writeTree(args: O<Parameters<typeof git.writeTree>[0]>) { return git.writeTree({ ...args, fs: this.fs, dir: this.dir }); }
}