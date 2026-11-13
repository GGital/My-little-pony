/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Full commit SHA of the build, passed by the Docker build (Lab 5 R-08); empty outside the pipeline. */
  readonly VITE_GIT_SHA?: string;
}
