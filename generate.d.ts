declare const fs: any;
declare const path: any;
declare const execSync: any;
declare const marked: any;
declare const resources: string[];
declare const moduleDescriptions: {
    area: {
        title: string;
        description: string;
        features: string[];
        endpoints: {
            method: string;
            path: string;
            description: string;
        }[];
    };
    user: {
        title: string;
        description: string;
        features: string[];
        endpoints: {
            method: string;
            path: string;
            description: string;
        }[];
    };
    worker: {
        title: string;
        description: string;
        features: string[];
        endpoints: {
            method: string;
            path: string;
            description: string;
        }[];
    };
    operation: {
        title: string;
        description: string;
        features: string[];
        endpoints: {
            method: string;
            path: string;
            description: string;
        }[];
    };
    client: {
        title: string;
        description: string;
        features: string[];
        endpoints: {
            method: string;
            path: string;
            description: string;
        }[];
    };
    task: {
        title: string;
        description: string;
        features: string[];
        endpoints: {
            method: string;
            path: string;
            description: string;
        }[];
    };
    auth: {
        title: string;
        description: string;
        features: string[];
        endpoints: {
            method: string;
            path: string;
            description: string;
        }[];
    };
    common: {
        title: string;
        description: string;
        features: string[];
        endpoints: never[];
    };
    'cron-job': {
        title: string;
        description: string;
        features: string[];
        endpoints: never[];
    };
    prisma: {
        title: string;
        description: string;
        features: string[];
        endpoints: never[];
    };
};
declare const mainDocsDir = "./docs";
declare const createModuleReadme: (resource: any) => string;
declare function getFilesRecursively(dir: string): string[];
declare function getClassName(fileName: any): any;
declare function getInterfaceName(fileName: any): string;
declare let readmeHtml: string;
declare let packageInfo: {
    name: string;
    version: string;
    description: string;
};
declare let indexHtml: string;
declare const resourceIcons: {
    area: string;
    user: string;
    worker: string;
    operation: string;
    client: string;
    task: string;
    auth: string;
    common: string;
    'cron-job': string;
    prisma: string;
};
declare const assetsDir = "./docs-assets";
