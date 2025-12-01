# Sling Initial-Content Patterns

## Optimal Formats for Sling Content Loader

### ✅ PREFERRED: JSON Format

**Use JSON for all content nodes** - Sling's content loader handles JSON reliably and consistently.

```
content/
  └── my-page.json          ← Single file, explicit structure
```

**Example:**
```json
{
    "jcr:primaryType": "nt:unstructured",
    "jcr:title": "My Page",
    "sling:resourceType": "myapp/components/my-component"
}
```

**Why JSON?**
- ✅ Explicit `jcr:primaryType` control
- ✅ No ambiguity about node structure
- ✅ Reliable loading behavior
- ✅ Easy to read and maintain
- ✅ Version control friendly

---

### ✅ GOOD: Direct HTML Files

**Use for static HTML pages** without component logic.

```
content/
  └── my-page.html          ← Direct HTML, creates nt:file
```

**When to use:**
- Static documentation pages
- Simple HTML content
- No dynamic rendering needed

**Sling behavior:**
- Creates `nt:file` node
- Stores HTML in `jcr:data` property
- Serves directly without processing

---

### ⚠️ PROBLEMATIC: Directory + `.content.xml`

**AVOID THIS PATTERN** - Sling's content loader often ignores `.content.xml` in directories.

```
content/
  └── my-page/              ← Directory (becomes sling:Folder)
      └── .content.xml      ← Often IGNORED! ❌
```

**What happens:**
1. Sling sees directory `my-page/`
2. **Defaults to `sling:Folder`** (even if `.content.xml` says otherwise)
3. `.content.xml` may be silently ignored
4. Result: Wrong `jcr:primaryType`, missing properties

**This is what broke `oak-chain-publish`:**
- Had directory with `.content.xml` specifying `nt:unstructured`
- Sling created `sling:Folder` instead
- Properties from `.content.xml` were ignored
- Page failed to render

---

## Migration Guide

### From `.content.xml` to JSON

**Before (broken):**
```
content/blockchain-aem/
  └── oak-chain-publish/           ← Directory
      └── .content.xml             ← Says nt:unstructured, but ignored
          <jcr:root 
            jcr:primaryType="nt:unstructured"
            sling:resourceType="blockchain-aem/components/oak-chain-publisher"/>
```

**After (fixed):**
```
content/blockchain-aem/
  └── oak-chain-publish.json       ← Single JSON file
      {
        "jcr:primaryType": "nt:unstructured",
        "sling:resourceType": "blockchain-aem/components/oak-chain-publisher"
      }
```

---

## Content Structure Best Practices

### 1. **Flat Structure for Content Nodes**

**Good:**
```
content/blockchain-aem/
  ├── blockchain.html              ← Direct HTML
  ├── agentic-chat.html            ← Direct HTML
  ├── blockchain-viewer.json       ← Component reference
  └── oak-chain-publish.json       ← Component reference
```

**Bad:**
```
content/blockchain-aem/
  ├── blockchain/                  ← Unnecessary nesting
  │   └── .content.xml             ← Unreliable
  └── agentic-chat/                ← Creates confusion
      └── .content.xml             ← May be ignored
```

---

### 2. **Component Structure**

**Components can use directories** with `.content.xml` (this works fine in `/apps`):

```
apps/blockchain-aem/components/
  └── my-component/
      ├── .content.xml             ← Works fine in /apps
      ├── my-component.html        ← Component script
      └── clientlibs/
          └── .content.xml         ← Also fine
```

**Why it works:**
- `/apps` structure is for **definitions**, not **instances**
- Component definitions are loaded differently than content
- Less likely to create ambiguous structures

---

### 3. **Hierarchical Content**

**For nested content, use JSON:**

```json
{
    "jcr:primaryType": "nt:unstructured",
    "sling:resourceType": "myapp/components/container",
    "child1": {
        "jcr:primaryType": "nt:unstructured",
        "sling:resourceType": "myapp/components/text",
        "text": "Hello World"
    },
    "child2": {
        "jcr:primaryType": "nt:unstructured",
        "sling:resourceType": "myapp/components/image",
        "src": "/content/dam/image.jpg"
    }
}
```

---

## Node Type Selection

### nt:unstructured
**Use for:** Content pages, component instances, generic containers

```json
{
    "jcr:primaryType": "nt:unstructured"
}
```

**Characteristics:**
- ✅ Most flexible
- ✅ Can have any properties
- ✅ Can have any child nodes
- ✅ Works with Sling resource types

### sling:Folder
**Use for:** Pure organizational structure (no rendering)

```json
{
    "jcr:primaryType": "sling:Folder"
}
```

**Characteristics:**
- Organizational only
- No rendering behavior
- **Default** when Sling creates directories

**⚠️ Problem:** Sling often creates these automatically when it should create `nt:unstructured`

### nt:file
**Automatic for:** `.html`, `.css`, `.js`, `.json` (non-content) files

**Don't specify manually** - Sling handles this automatically for static files.

---

## Build Process Verification

### Check What Gets Packaged

```bash
# Verify JSON files are in the bundle
unzip -l target/*.jar | grep "initial-content.*\.json"

# Verify no .content.xml in content/ paths
unzip -l target/*.jar | grep "initial-content/content/.*\.content\.xml"
# Should return NOTHING for content paths
```

### Test Deployment

```bash
# Check node was created correctly
curl -s -u admin:admin "http://localhost:4502/path/to/node.json"

# Verify jcr:primaryType
# Should show: "jcr:primaryType": "nt:unstructured"
# NOT: "jcr:primaryType": "sling:Folder"
```

---

## Summary

| Pattern | Reliability | Use Case |
|---------|-------------|----------|
| **`.json` file** | ✅ Excellent | **Preferred** - Content nodes with component refs |
| **`.html` file** | ✅ Excellent | Static HTML pages |
| **Directory + `.content.xml`** | ❌ Unreliable | **AVOID** - Often creates wrong node type |

**Golden Rule:** If it's content (in `/content`), use JSON or direct HTML files. Never use directory + `.content.xml`.

---

## Lessons Learned

### Issue: oak-chain-publish Not Rendering

**Problem:**
- Used directory + `.content.xml` pattern
- Sling created `sling:Folder` instead of `nt:unstructured`
- `.content.xml` properties were ignored
- Page returned "Resource dumped by HtmlRenderer" (no rendering)

**Root Cause:**
- Monolithic HTML pages were refactored to component-based
- New structure used unreliable `.content.xml` pattern
- Sling's content loader has quirky behavior with directories

**Solution:**
- Converted to `.json` format
- Explicit node structure in JSON
- Reliable, predictable loading

**Prevention:**
- **Always use JSON for content nodes**
- Document preferred patterns (this file)
- Add build verification to check no `.content.xml` in `/content`

---

## Build Kinks Identified

1. **Directory structure ambiguity** - Sling guesses `sling:Folder` by default
2. **`.content.xml` unreliability** - Sometimes ignored in directories
3. **Lack of verification** - Build doesn't fail when content loads wrong
4. **No clear patterns** - Mixed approaches across codebase

## Fixes Implemented

1. ✅ Converted `oak-chain-publish` to JSON format
2. ✅ Documented preferred patterns (this file)
3. 🔄 TODO: Add build verification to catch these issues
4. 🔄 TODO: Audit remaining content for `.content.xml` anti-pattern

---

## Recommended Build Verification

Add to Maven build:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-antrun-plugin</artifactId>
    <executions>
        <execution>
            <phase>verify</phase>
            <goals><goal>run</goal></goals>
            <configuration>
                <target>
                    <!-- Fail if .content.xml found in /content -->
                    <fail message="ERROR: .content.xml files found in initial-content/content/. Use JSON format instead!">
                        <condition>
                            <resourcecount when="greater" count="0">
                                <fileset dir="${project.build.directory}/classes/initial-content/content" 
                                         includes="**/.content.xml"/>
                            </resourcecount>
                        </condition>
                    </fail>
                </target>
            </configuration>
        </execution>
    </executions>
</plugin>
```

This will **fail the build** if anyone adds `.content.xml` to content paths, preventing this issue.

