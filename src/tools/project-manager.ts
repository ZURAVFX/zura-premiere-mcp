import path from "node:path";
import { buildToolScript, escapeForExtendScript } from "../bridge/script-builder.js";
import { sendCommand, BridgeOptions } from "../bridge/file-bridge.js";

export function getProjectManagerTools(bridgeOptions: BridgeOptions) {
  return {
    consolidate_and_transfer: {
      description:
        "PORTABLE-PACKAGE ONLY. Copies or transcodes source media into a new Premiere project and may copy full-length source footage, using substantial disk space. For ordinary reel exports plus an editable project, save the project with its source media linked instead. Call this only when the user explicitly requests a self-contained/portable package and confirms copying source media. Pass the user's exact absolute destination; Premiere creates a Copied_<project> folder inside it.",
      parameters: {
        type: "object" as const,
        properties: {
          destination_path: {
            type: "string",
            description: "Absolute destination directory explicitly requested by the user for the portable package",
          },
          confirm_media_copy: {
            type: "boolean",
            description:
              "Required true only after the user explicitly requests a portable/self-contained project with source footage copied and confirms that copy. A request for reel exports, an editable project, or a delivery folder is not consent. Missing or false is rejected.",
          },
          include_all_sequences: {
            type: "boolean",
            description: "Include all sequences (default: true). If false, only the active sequence is used.",
          },
          copy_to_new_location: {
            type: "boolean",
            description: "Legacy compatibility option. Must be true because Premiere's scripted Project Manager always copies media into destination_path.",
          },
          exclude_unused: {
            type: "boolean",
            description: "Exclude unused clips (default: true)",
          },
          transcode: {
            type: "boolean",
            description: "Transcode media to match the sequence instead of copying it (default: false)",
          },
          include_preview_files: {
            type: "boolean",
            description: "Include preview/render files (default: false)",
          },
          rename_media: {
            type: "boolean",
            description: "Rename media to match clip names (default: false)",
          },
          convert_image_sequences: {
            type: "boolean",
            description: "Convert image sequences to clips (default: false)",
          },
          convert_ae_comps: {
            type: "boolean",
            description: "Convert After Effects compositions (default: false)",
          },
          convert_synthetic: {
            type: "boolean",
            description: "Convert synthetic importer items (default: false)",
          },
        },
        required: ["destination_path", "confirm_media_copy"],
      },
      handler: async (args: {
        destination_path: string;
        confirm_media_copy?: boolean;
        include_all_sequences?: boolean;
        copy_to_new_location?: boolean;
        exclude_unused?: boolean;
        transcode?: boolean;
        include_preview_files?: boolean;
        rename_media?: boolean;
        convert_image_sequences?: boolean;
        convert_ae_comps?: boolean;
        convert_synthetic?: boolean;
      }) => {
        if (args.confirm_media_copy !== true) {
          return {
            success: false,
            error:
              "Media transfer is blocked unless the user explicitly requests a portable/self-contained project and confirms copying source footage. For reel exports plus an editable project, save the project with linked source media instead.",
          };
        }
        const destinationPath = args.destination_path.trim();
        if (!destinationPath) {
          return { success: false, error: "destination_path must not be empty" };
        }
        if (!path.isAbsolute(destinationPath)) {
          return { success: false, error: "destination_path must be an absolute path explicitly requested by the user" };
        }
        if (args.copy_to_new_location === false) {
          return { success: false, error: "copy_to_new_location false is not supported: Premiere's scripted Project Manager always collects media into destination_path." };
        }
        const destinationInput = destinationPath.replace(/[\\/]+$/, "") || path.parse(destinationPath).root;
        const destination = escapeForExtendScript(destinationInput);
        const requestedDestination = escapeForExtendScript(destinationPath);
        // Project Manager always copies or transcodes source footage. Require a
        // separate explicit opt-in so ordinary reel delivery cannot trigger a
        // full-media package by mistake.
        const script = buildToolScript(`
          var pm = app.projectManager;
          if (!pm || !pm.options) return __error("Project Manager not available");
          var project = app.project;
          if (!project) return __error("No project is open");
          ${args.include_all_sequences === false ? `if (!project.activeSequence) return __error("include_all_sequences is false but there is no active sequence");` : ""}

          var destinationFolder = new Folder("${destination}");
          if (destinationFolder.exists && !__isDirectory(destinationFolder.fsName)) return __error("destination_path " + destinationFolder.fsName + " is a file, not a folder");
          if (!destinationFolder.exists && !destinationFolder.create()) return __error("Could not create destination_path " + destinationFolder.fsName);
          var destinationFsName = destinationFolder.fsName;
          var outputName = "Copied_" + String(project.name).replace(/\\.prproj$/i, "");
          var output = new Folder(destinationFsName + "/" + outputName);
          if (output.exists) {
            return __error(output.fsName + " already exists; choose another absolute destination_path so the new copy can be verified.");
          }

          var o = pm.options;
          o.clipTransferOption = ${args.transcode ? "o.CLIP_TRANSFER_TRANSCODE" : "o.CLIP_TRANSFER_COPY"};
          ${args.transcode ? "o.clipTranscoderOption = o.CLIP_TRANSCODE_MATCH_SEQUENCE;" : ""}
          o.includeAllSequences = ${args.include_all_sequences !== false};
          ${args.include_all_sequences === false ? "o.affectedSequences = [project.activeSequence];" : ""}
          o.excludeUnused = ${args.exclude_unused !== false};
          o.includePreviews = ${args.include_preview_files === true};
          o.renameMedia = ${args.rename_media === true};
          o.convertImageSequencesToClips = ${args.convert_image_sequences === true};
          o.convertAECompsToClips = ${args.convert_ae_comps === true};
          o.convertSyntheticsToClips = ${args.convert_synthetic === true};
          o.destinationPath = destinationFsName + "/";

          var status = pm.process(project);
          var errors = [];
          try { for (var e = 0; e < pm.errors.length; e++) errors.push(String(pm.errors[e])); } catch (eErrors) {}
          if (!output.exists) {
            return __jsonStringify({ success: false, error: "Project Manager did not create the expected output at " + output.fsName + " (process returned " + status + ").", data: { requestedDestination: "${requestedDestination}", destination: destinationFsName, expectedOutputFolder: output.fsName, status: status, errors: errors } });
          }

          var projects = output.getFiles("*.prproj");
          var files = [];
          var fileCount = 0;
          var totalBytes = 0;
          var scanComplete = true;
          var scanErrors = [];
          var walk = function (folder, prefix) {
            var entries = [];
            try { entries = folder.getFiles(); }
            catch (eList) { scanComplete = false; scanErrors.push(folder.fsName + ": " + String(eList)); return; }
            for (var f = 0; f < entries.length; f++) {
              if (entries[f] instanceof Folder) {
                walk(entries[f], prefix + entries[f].name + "/");
              } else {
                fileCount++;
                var length = Number(entries[f].length);
                if (isFinite(length) && length >= 0) totalBytes += length;
                else { scanComplete = false; scanErrors.push("Could not read file size: " + entries[f].fsName); }
                if (files.length < 500) {
                  var fileName = String(entries[f].name);
                  try { fileName = decodeURI(fileName); } catch (eDecode) {}
                  files.push(prefix + fileName);
                }
              }
            }
          };
          walk(output, "");

          var actualDestination = "";
          try { actualDestination = output.parent.fsName; } catch (eParent) {}
          var normalizePath = function (value) { return String(value).replace(/\\\\/g, "/").replace(/\\/+$/, "").toLowerCase(); };
          var destinationMatches = actualDestination && normalizePath(actualDestination) === normalizePath(destinationFsName);
          var copiedProject = projects && projects.length > 0 ? projects[0].fsName : null;
          var resultData = {
            requestedDestination: "${requestedDestination}",
            destination: destinationFsName,
            actualDestination: actualDestination,
            outputFolder: output.fsName,
            copiedProject: copiedProject,
            processStatus: status,
            fileCount: fileCount,
            totalBytes: totalBytes,
            files: files,
            filesTruncated: fileCount > files.length,
            scanComplete: scanComplete,
            scanErrors: scanErrors,
            errors: errors
          };
          if (status !== 0) {
            return __jsonStringify({ success: false, error: "Project Manager returned nonzero status " + status + "; do not report packaging complete. Inspect the exact leftover output folder.", data: resultData });
          }
          if (!destinationMatches) {
            return __jsonStringify({ success: false, error: "Project Manager output parent did not match the requested destination; do not report packaging complete.", data: resultData });
          }
          if (!projects || projects.length < 1) {
            return __jsonStringify({ success: false, error: output.fsName + " was created but holds no copied .prproj (process returned " + status + ").", data: resultData });
          }
          if (!scanComplete) {
            return __jsonStringify({ success: false, error: "Could not fully inspect the Project Manager output; do not report packaging complete.", data: resultData });
          }
          return __result({
            completed: true,
            verified: true,
            requestedDestination: "${requestedDestination}",
            destination: destinationFsName,
            actualDestination: actualDestination,
            outputFolder: output.fsName,
            copiedProject: copiedProject,
            scope: ${args.include_all_sequences === false ? "\"active sequence: \" + project.activeSequence.name" : "\"all sequences\""},
            transferMode: "${args.transcode ? "transcode (match sequence)" : "copy"}",
            fileCount: fileCount,
            totalBytes: totalBytes,
            files: files,
            filesTruncated: fileCount > files.length,
            errors: errors
          });
        `);
        return sendCommand(script, { ...bridgeOptions, timeoutMs: 300000 }); // 5 min timeout
      },
    },
  };
}
