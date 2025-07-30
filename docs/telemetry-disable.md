# Disabling telemetry in Strapi v5

**Strapi v5 collects telemetry data by default, but provides three straightforward methods to disable it completely.** The simplest approach is setting the `STRAPI_TELEMETRY_DISABLED=true` environment variable in your `.env` file. All methods from Strapi v4 continue to work unchanged in v5, making migration seamless. However, be aware that browser-based telemetry from the admin panel may require additional blocking measures.

## Three methods to disable telemetry

Strapi v5 offers multiple approaches to disable telemetry, each with its own advantages. The environment variable method is recommended for its simplicity and immediate effect.

### Environment variable approach

Add this line to your `.env` file in the project root:
```bash
STRAPI_TELEMETRY_DISABLED=true
```

This method takes effect immediately upon server restart and is the **most straightforward approach**. The variable accepts boolean values, with `true` disabling all server-side telemetry collection. For projects using TypeScript or SQLite (as in your setup command), no additional configuration is needed.

### CLI command method

Use Strapi's built-in commands to toggle telemetry:
```bash
# Disable telemetry
npm run strapi telemetry:disable

# Re-enable if needed
npm run strapi telemetry:enable
```

These commands modify your project configuration persistently. The **CLI method is ideal for one-time setup** during initial project configuration or when you need to quickly toggle telemetry settings without editing files.

### Package.json configuration

Add a telemetry flag to your `package.json`:
```json
{
  "name": "your-strapi-project",
  "strapi": {
    "telemetryDisabled": true
  }
}
```

This method embeds the telemetry preference directly in your project configuration, making it **version-controlled and portable** across development environments.

## Configuration file locations and structure

Strapi v5 maintains its configuration in a standardized directory structure. Understanding these locations helps when troubleshooting telemetry settings.

```
project-root/
├── config/
│   ├── server.ts         # Server configuration
│   ├── database.ts       # Database configuration  
│   ├── admin.ts          # Admin panel configuration
│   └── env/              # Environment-specific configs
├── .env                  # Environment variables (STRAPI_TELEMETRY_DISABLED goes here)
└── package.json          # Project configuration (telemetryDisabled option)
```

For TypeScript projects created with your specific command, all configuration files use `.ts` extensions. The **telemetry setting itself is not configured in these files** but through the three methods described above.

## Important considerations for complete privacy

While server-side telemetry respects your configuration settings, the admin panel may still send browser-based telemetry requests to `https://analytics.strapi.io/track`. This behavior persists from v4 into v5 and represents a known issue in the Strapi ecosystem.

To ensure complete telemetry blocking:
1. Set `STRAPI_TELEMETRY_DISABLED=true` in your environment
2. Add `telemetryDisabled: true` to package.json for redundancy
3. **Monitor network requests** in browser developer tools
4. Consider network-level blocking of `*.strapi.io` analytics domains if absolute privacy is required

## Differences from Strapi v4

The telemetry configuration in Strapi v5 remains **identical to v4**, with no breaking changes or new requirements. All three methods (environment variable, CLI commands, and package.json configuration) work exactly as they did in the previous version. The environment variable `STRAPI_TELEMETRY_DISABLED` continues to be the primary control mechanism, unlike some other v4 environment variables that moved to configuration files in v5.

TypeScript and SQLite projects require no special telemetry configuration. The telemetry settings apply universally regardless of your chosen database or whether you're using JavaScript or TypeScript templates.

## Verification and implementation

After configuring telemetry settings, verify they're working correctly by checking network requests in your browser's developer tools. Start your Strapi application and navigate through the admin panel while monitoring for requests to `analytics.strapi.io`. 

For your specific setup command with TypeScript and SQLite, implement telemetry disabling immediately after project creation:
```bash
# After running your create command
cd strapi-test
echo "STRAPI_TELEMETRY_DISABLED=true" >> .env
npm run build
npm run develop
```

The telemetry configuration persists across server restarts and deployments, requiring no additional maintenance once set.

## Conclusion

Disabling telemetry in Strapi v5 requires minimal configuration through any of three methods, with the environment variable approach being the simplest and most reliable. **No changes from v4 mean existing knowledge transfers directly**, while the persistent browser telemetry issue requires awareness and potentially additional blocking measures. For TypeScript projects with SQLite, the standard telemetry controls work without modification, ensuring privacy-conscious developers can easily opt out of data collection while maintaining full framework functionality.