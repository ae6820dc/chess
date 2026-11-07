package io.github.ae6820dc.studio;

import android.webkit.JavascriptInterface;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;

/** Bounded, offline UCI transport. No caller-controlled executable or filesystem path. */
public final class NativeEngine {
    private final String executable;
    private final Map<String,Session> sessions=new HashMap<>();
    NativeEngine(String libDir){executable=libDir+"/libstockfish.so";}
    private static final class Session {
        final Process process;
        final BufferedWriter input;
        final ArrayBlockingQueue<String> lines=new ArrayBlockingQueue<>(512);
        volatile boolean closed;
        volatile String error;
        Session(Process p){process=p;input=new BufferedWriter(new OutputStreamWriter(p.getOutputStream(),StandardCharsets.UTF_8));}
        void destroy(){closed=true;try{input.close();}catch(IOException ignored){}process.destroy();process.destroyForcibly();lines.clear();}
    }
    @JavascriptInterface public int cores(){return Runtime.getRuntime().availableProcessors();}
    @JavascriptInterface public synchronized String open(String id){
        if(id==null||!id.matches("[a-zA-Z0-9-]{1,64}"))return "Invalid engine ID";
        if(sessions.containsKey(id))return "Engine already exists";
        if(sessions.size()>=2)return "Maximum two engines";
        try{
            Session s=new Session(new ProcessBuilder(executable).redirectErrorStream(true).start());
            sessions.put(id,s);
            Thread reader=new Thread(()->{
                try(BufferedReader in=new BufferedReader(new InputStreamReader(s.process.getInputStream(),StandardCharsets.UTF_8))){
                    String line;
                    while((line=in.readLine())!=null&&!s.closed){
                        // Keep handshake and bestmove lines; discard excess analysis output only.
                        if(line.startsWith("info ")&&!line.contains("CRITICAL ERROR")){s.lines.offer(line);}
                        else if(!s.lines.offer(line,5,TimeUnit.SECONDS)){s.error="Engine output queue full";break;}
                    }
                    if(!s.closed&&s.error==null)s.error="Stockfish exited unexpectedly";
                }catch(Exception e){if(!s.closed)s.error=e.toString();}
            },"Stockfish-"+id);
            reader.setDaemon(true);reader.start();return "";
        }catch(IOException e){return "Cannot start native Stockfish: "+e.getMessage();}
    }
    @JavascriptInterface public synchronized String send(String id,String command){
        Session s=sessions.get(id);if(s==null||s.closed)return "Engine closed";
        if(command==null||command.length()>65536||command.contains("\n")||command.contains("\r"))return "Invalid UCI command";
        if(!(command.equals("uci")||command.equals("isready")||command.equals("stop")||command.equals("ucinewgame")||command.startsWith("position startpos")||command.startsWith("go ")||command.matches("setoption name (Hash|Threads|UCI_LimitStrength|UCI_Elo) value [a-z0-9]+")))return "Unsupported UCI command";
        try{s.input.write(command);s.input.newLine();s.input.flush();return "";}catch(IOException e){return e.toString();}
    }
    @JavascriptInterface public synchronized String poll(String id){
        JSONArray out=new JSONArray();Session s=sessions.get(id);
        try{
            if(s==null){out.put(new JSONObject().put("error","Engine closed"));return out.toString();}
            String line;int count=0;
            while(count++<128&&(line=s.lines.poll())!=null)out.put(new JSONObject().put("line",line));
            if(s.error!=null&&s.lines.isEmpty())out.put(new JSONObject().put("error",s.error));
        }catch(JSONException e){throw new IllegalStateException(e);}
        return out.toString();
    }
    @JavascriptInterface public synchronized void close(String id){Session s=sessions.remove(id);if(s!=null)s.destroy();}
    public synchronized void closeAll(){for(Session s:sessions.values())s.destroy();sessions.clear();}
}
