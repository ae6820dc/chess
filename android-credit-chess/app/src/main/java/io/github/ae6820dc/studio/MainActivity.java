package io.github.ae6820dc.studio;

import android.app.*;
import android.os.*;
import android.content.*;
import android.net.Uri;
import android.graphics.Color;
import android.view.*;
import android.webkit.*;
import android.widget.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Offline-only host. Original application files are served without transformation. */
public final class MainActivity extends Activity {
    private static final String SUFFIX = ".appassets.androidplatform.net";
    private static final int CHOOSE_FILE=1, SAVE_FILE=2, IMPORT_STORAGE=3, LIMIT=32*1024*1024;
    private final List<JSONObject> programs = new ArrayList<>();
    private LinearLayout root;
    private FrameLayout content;
    private WebView web;
    private JSONObject current;
    private ValueCallback<Uri[]> chooser;
    private byte[] pendingDownload;
    private String pendingOrigin, importOrigin;
    private boolean downloading;

    private String text(JSONObject p,String key) { return p.optString(key, ""); }
    private String origin(JSONObject p) { return "https://"+text(p,"id")+SUFFIX; }
    private String url(JSONObject p) { return origin(p)+"/"+text(p,"path"); }
    private byte[] read(InputStream stream) throws IOException {
        try (InputStream in=stream; ByteArrayOutputStream out=new ByteArrayOutputStream()) {
            byte[] buffer=new byte[16384]; int n;
            while ((n=in.read(buffer))!=-1) { if(out.size()+n>LIMIT)throw new IOException("File exceeds 32 MB");out.write(buffer,0,n); }
            return out.toByteArray();
        }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            JSONArray catalog=new JSONArray(new String(read(getAssets().open("catalog.json")), StandardCharsets.UTF_8));
            for(int i=0;i<catalog.length();i++)programs.add(catalog.getJSONObject(i));
        } catch(Exception e) { throw new IllegalStateException("Invalid offline catalog",e); }
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(0xff101827);
        if(Build.VERSION.SDK_INT>=30)getWindow().setDecorFitsSystemWindows(false);
        root.setOnApplyWindowInsetsListener((view,insets)->{
            if(Build.VERSION.SDK_INT>=30) {
                android.graphics.Insets safe=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());
                view.setPadding(safe.left,safe.top,safe.right,safe.bottom);
            } else {
                int l=insets.getSystemWindowInsetLeft(),t=insets.getSystemWindowInsetTop(),r=insets.getSystemWindowInsetRight(),b=insets.getSystemWindowInsetBottom();
                if(Build.VERSION.SDK_INT>=28 && insets.getDisplayCutout()!=null) {
                    DisplayCutout c=insets.getDisplayCutout();l=Math.max(l,c.getSafeInsetLeft());t=Math.max(t,c.getSafeInsetTop());r=Math.max(r,c.getSafeInsetRight());b=Math.max(b,c.getSafeInsetBottom());
                }
                view.setPadding(l,t,r,b);
            }
            return insets;
        });
        LinearLayout toolbar=new LinearLayout(this);toolbar.setMinimumHeight(dp(48));
        String[] labels={"‹ Back","Home","Programs","Backup"};
        for(int i=0;i<labels.length;i++) {
            final int action=i;Button button=new Button(this);button.setText(labels[i]);button.setTextSize(12);button.setAllCaps(false);
            button.setPadding(0,0,0,0);button.setContentDescription(labels[i]);
            button.setOnClickListener(v->{if(action==0)back();else if(action==1)leave(this::home);else if(action==2)menu();else backups();});
            toolbar.addView(button,new LinearLayout.LayoutParams(0,dp(48),1));
        }
        root.addView(toolbar);content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        setContentView(root);
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE)!=0);
        web=new WebView(this);web.setBackgroundColor(0xff101827);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSupportMultipleWindows(false);
        web.addJavascriptInterface(new Downloads(),"StudioDownloads");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return asset(r.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){
                if(!r.isForMainFrame())return false;
                Uri u=r.getUrl();String path=u.getPath();
                if(!trusted(u)){message("External navigation is unavailable in this offline app.");return true;}
                for(JSONObject p:programs)if(("/"+text(p,"path")).equals(path)) {
                    if(!url(p).equals(u.toString())){leave(()->open(p));return true;}return false;
                }
                if(path!=null && path.endsWith("/index.html") && !path.contains("stockfish")){leave(MainActivity.this::home);return true;}
                if(current!=null && text(current,"kind").equals("chess") && path!=null && path.startsWith("/credit-chess/stockfish/"))return false;
                message("Use Programs to select an application.");return true;
            }
            @Override public void onPageFinished(WebView v,String u){
                for(JSONObject p:programs)if(url(p).equals(u))current=p;
                if(current==null || !u.startsWith(origin(current)+"/"))return;
                try {String code=new String(read(getAssets().open("host.js")),StandardCharsets.UTF_8);v.evaluateJavascript(code,null);}catch(IOException e){message(e.getMessage());}
            }
        });
        // Service-worker cache misses must use the same local asset handler as pages/workers.
        ServiceWorkerController controller=ServiceWorkerController.getInstance();
        controller.getServiceWorkerWebSettings().setAllowFileAccess(false);
        controller.getServiceWorkerWebSettings().setAllowContentAccess(false);
        controller.getServiceWorkerWebSettings().setBlockNetworkLoads(true);
        controller.setServiceWorkerClient(new ServiceWorkerClient(){@Override public WebResourceResponse shouldInterceptRequest(WebResourceRequest request){return asset(request.getUrl());}});
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onShowCustomView(View view,CustomViewCallback callback){callback.onCustomViewHidden();message("Android system bars stay visible in this app.");}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;
                try {Intent pick=params.createIntent();pick.addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(pick,CHOOSE_FILE);}catch(ActivityNotFoundException e){chooser.onReceiveValue(null);chooser=null;message("No file picker is installed.");}return true;
            }
            @Override public boolean onJsAlert(WebView view,String u,String msg,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("OK",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView view,String u,String msg,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(msg).setPositiveButton("OK",(d,w)->result.confirm()).setNegativeButton("Cancel",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
        });
        web.setDownloadListener((u,agent,disposition,mime,length)->{
            if(!u.startsWith("blob:")&&!u.startsWith("data:")){message("Only local application downloads are supported.");return;}
            String filename=URLUtil.guessFileName(u,disposition,mime);
            web.evaluateJavascript("window.studioDownload("+JSONObject.quote(u)+","+JSONObject.quote(filename)+")",null);
        });
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(0,this::back);
        JSONObject restored=null;
        if(state!=null)for(JSONObject p:programs)if(text(p,"id").equals(state.getString("program")))restored=p;
        if(restored==null)home();else open(restored);
        systemBars();
    }
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private void home(){
        current=null;web.loadUrl("about:blank");content.removeAllViews();
        ScrollView scroll=new ScrollView(this);LinearLayout list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);list.setPadding(dp(16),dp(8),dp(16),dp(24));
        TextView heading=new TextView(this);heading.setText(getString(getApplicationInfo().labelRes)+"\nChoose a program · Fully offline");heading.setTextSize(24);heading.setTextColor(Color.WHITE);list.addView(heading);
        String group="";
        for(JSONObject p:programs){if(!text(p,"group").equals(group)){group=text(p,"group");TextView title=new TextView(this);title.setText(group);title.setTextSize(19);title.setTextColor(0xff73dbb6);title.setPadding(0,dp(22),0,dp(8));list.addView(title);}Button choose=new Button(this);choose.setAllCaps(false);choose.setText(text(p,"name"));choose.setOnClickListener(v->open(p));list.addView(choose,new LinearLayout.LayoutParams(-1,-2));}
        scroll.addView(list);content.addView(scroll);
    }
    private void open(JSONObject p){current=p;content.removeAllViews();if(web.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)web.getParent()).removeView(web);content.addView(web,new FrameLayout.LayoutParams(-1,-1));web.loadUrl(url(p));}
    private void leave(Runnable next){if(downloading){message("Finish saving the file before switching programs.");return;}if(current==null){next.run();return;}web.evaluateJavascript("if(typeof save==='function')save();if(window.studioSaveForm)window.studioSaveForm();",ignored->next.run());}
    private void menu(){String[] names=new String[programs.size()];for(int i=0;i<names.length;i++)names[i]=text(programs.get(i),"group")+" · "+text(programs.get(i),"name");new AlertDialog.Builder(this).setTitle("Switch program").setItems(names,(d,i)->leave(()->open(programs.get(i)))).setNegativeButton("Cancel",null).show();}
    private boolean trusted(Uri u){if(!"https".equals(u.getScheme())||u.getPort()!=-1||u.getUserInfo()!=null)return false;for(JSONObject p:programs)if((text(p,"id")+SUFFIX).equals(u.getHost()))return true;return false;}
    private WebResourceResponse asset(Uri u){
        if(!trusted(u))return response("text/plain",403,"Forbidden",new byte[0]);
        String path=u.getPath();if(path==null || path.contains("..") || path.contains("\\") || path.indexOf('\0')>=0)return response("text/plain",400,"Bad Request",new byte[0]);
        if(path.endsWith("/"))path+="index.html";
        try {return response(mime(path),200,"OK",read(getAssets().open("site"+path+(path.endsWith(".gz")?".bin":""))));}catch(IOException e){return response("text/plain",404,"Not Found",new byte[0]);}
    }
    private WebResourceResponse response(String mime,int status,String reason,byte[] bytes){
        Map<String,String> headers=new HashMap<>();headers.put("Cache-Control","no-cache");headers.put("X-Content-Type-Options","nosniff");headers.put("Cross-Origin-Resource-Policy","same-origin");
        return new WebResourceResponse(mime,(mime.startsWith("text/")||mime.contains("javascript")||mime.contains("json"))?"UTF-8":null,status,reason,headers,new ByteArrayInputStream(bytes));
    }
    private String mime(String p){String ext=p.substring(p.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);switch(ext){case "html":return "text/html";case "js":return "application/javascript";case "css":return "text/css";case "wasm":return "application/wasm";case "json":return "application/json";case "webmanifest":return "application/manifest+json";case "svg":return "image/svg+xml";case "png":return "image/png";case "txt":return "text/plain";default:return "application/octet-stream";}}
    private void back(){if(current==null){moveTaskToBack(true);return;}web.evaluateJavascript("(function(){var o=document.getElementById('jumpOverlay');if(o&&o.classList.contains('open')){document.getElementById('jumpCancel').click();return true;}return false;})()",closed->{if(!"true".equals(closed)){if(web.canGoBack() && !web.copyBackForwardList().getItemAtIndex(web.copyBackForwardList().getCurrentIndex()-1).getUrl().equals("about:blank"))leave(()->web.goBack());else leave(this::home);}});}
    @android.annotation.SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation") @Override public void onBackPressed(){back();}
    private void systemBars(){getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);if(Build.VERSION.SDK_INT>=30){getWindow().setDecorFitsSystemWindows(false);WindowInsetsController c=getWindow().getInsetsController();if(c!=null){c.show(WindowInsets.Type.systemBars());c.setSystemBarsAppearance(0,WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS|WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);}}else getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);if(root!=null)root.requestApplyInsets();}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus)systemBars();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();systemBars();}
    @Override protected void onPause(){if(web!=null){web.evaluateJavascript("if(typeof save==='function')save();if(window.studioSaveForm)window.studioSaveForm();",null);web.onPause();}super.onPause();}
    @Override protected void onSaveInstanceState(Bundle state){if(current!=null)state.putString("program",text(current,"id"));super.onSaveInstanceState(state);}
    private void message(String msg){runOnUiThread(()->Toast.makeText(this,msg,Toast.LENGTH_LONG).show());}
    private void backups(){
        if(current==null){message("Open a program first. Backups are isolated per program.");return;}
        if(text(current,"kind").equals("chess")){new AlertDialog.Builder(this).setTitle("Credit Chess backups").setMessage("Open either board, then Preferences & backups. Export JSON or an encrypted backup; import using the original Import file control. These include accounts, games and Arena history. Android's file picker saves and opens the files.").setPositiveButton("OK",null).show();return;}
        new AlertDialog.Builder(this).setTitle("Current program backup").setItems(new String[]{"Export local state","Import local state"},(d,i)->{
            if(i==0){web.evaluateJavascript("if(typeof save==='function')save();if(window.studioSaveForm)window.studioSaveForm();window.studioExport();",null);}
            else {importOrigin=origin(current);Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(pick,IMPORT_STORAGE);}
        }).setNegativeButton("Cancel",null).show();
    }
    private final class Downloads {
        @JavascriptInterface public void save(String name,String mime,String base64){
            if(base64.length()>LIMIT*4/3){message("Download exceeds 32 MB");return;}
            byte[] bytes;try{bytes=android.util.Base64.decode(base64,android.util.Base64.DEFAULT);}catch(IllegalArgumentException e){message("Invalid download");return;}
            runOnUiThread(()->{
                if(current==null||downloading){message("Another download is pending.");return;}
                pendingDownload=bytes;pendingOrigin=origin(current);downloading=true;
                Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime.isEmpty()?"application/octet-stream":mime).putExtra(Intent.EXTRA_TITLE,name.replaceAll("[^a-zA-Z0-9._-]","_"));
                try{startActivityForResult(save,SAVE_FILE);}catch(ActivityNotFoundException e){pendingDownload=null;downloading=false;message("No file picker installed.");}
            });
        }
        @JavascriptInterface public void error(String msg){message(msg);}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==CHOOSE_FILE){if(chooser!=null){chooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));chooser=null;}return;}
        if(request==SAVE_FILE){
            byte[] bytes=pendingDownload;pendingDownload=null;downloading=false;
            if(result==RESULT_OK && data!=null && bytes!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new IOException("Cannot save file");out.write(bytes);message("File saved.");}catch(IOException e){message(e.getMessage());}}return;
        }
        if(request==IMPORT_STORAGE && result==RESULT_OK && data!=null && current!=null && origin(current).equals(importOrigin)){
            try {
                JSONObject backup=new JSONObject(new String(read(getContentResolver().openInputStream(data.getData())),StandardCharsets.UTF_8));
                if(backup.optInt("schema")!=1||!text(current,"id").equals(backup.optString("program")))throw new IOException("Backup belongs to a different program.");
                JSONObject values=backup.getJSONObject("localStorage");Iterator<String> keys=values.keys();while(keys.hasNext())if(!(values.get(keys.next()) instanceof String))throw new IOException("Invalid storage values.");
                final String target=origin(current),script="(function(){var v="+values+";for(var k of Object.keys(v))localStorage.setItem(k,v[k]);location.reload();})()";
                new AlertDialog.Builder(this).setTitle("Import this program's backup?").setMessage("Matching keys will be replaced. Export the current state first if you want to keep it. Other programs are unaffected.").setPositiveButton("Import",(d,w)->{if(current!=null&&origin(current).equals(target))web.evaluateJavascript(script,null);}).setNegativeButton("Cancel",null).show();
            }catch(Exception e){message("Import failed: "+e.getMessage());}
        }
    }
}
