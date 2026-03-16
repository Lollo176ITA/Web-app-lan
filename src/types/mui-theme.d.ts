import "@mui/material/styles";

type AppKindTone = {
  main: string;
  soft: string;
  border: string;
  contrastText: string;
};

type AppStatusTone = {
  main: string;
  soft: string;
  border: string;
  label: string;
};

interface AppThemeTokens {
  surfaces: {
    shell: string;
    sunken: string;
    raised: string;
    overlay: string;
    contrast: string;
  };
  outlines: {
    soft: string;
    strong: string;
    focus: string;
  };
  gradients: {
    hero: string;
    shell: string;
    accent: string;
    media: string;
  };
  status: {
    pass: AppStatusTone;
    warn: AppStatusTone;
    fail: AppStatusTone;
    info: AppStatusTone;
  };
  kind: {
    folder: AppKindTone;
    video: AppKindTone;
    image: AppKindTone;
    audio: AppKindTone;
    document: AppKindTone;
    archive: AppKindTone;
    other: AppKindTone;
  };
}

declare module "@mui/material/styles" {
  interface Theme {
    app: AppThemeTokens;
  }

  interface ThemeOptions {
    app?: Partial<AppThemeTokens>;
  }
}
