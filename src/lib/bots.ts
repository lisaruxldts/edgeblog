// 只收录外链分析 / SEO 审计类爬虫；搜索引擎与 AI 爬虫不在此列
const SEO_BOTS =
	/AhrefsBot|AhrefsSiteAudit|SemrushBot|SiteAuditBot|SplitSignalBot|MJ12bot|DotBot|rogerbot|BLEXBot|DataForSeoBot|serpstatbot|SEOkicks|Barkrowler|MegaIndex|linkdexbot|spbot|Screaming Frog|Sitebulb|SEOlyticsCrawler|LinkpadBot|SearchmetricsBot|cognitiveSEO|Linkfluence/i;

export const isSeoBot = (userAgent: string | null): boolean => !!userAgent && SEO_BOTS.test(userAgent);
