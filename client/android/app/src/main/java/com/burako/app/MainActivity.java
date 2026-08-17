package com.burako.app;

import android.os.Build;
import android.os.Bundle;
import android.graphics.Rect;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import java.util.Collections;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applyImmersiveMode();
        excludeEdgeGesturesOnceLaidOut();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Android vuelve a mostrar las barras del sistema cada vez que la ventana
        // recupera el foco (volver de otra app, cerrar el teclado, etc.) — sin esto,
        // "pantalla completa" solo duraba hasta el primer toque cerca del borde.
        if (hasFocus) applyImmersiveMode();
    }

    // Oculta la barra de estado (batería/hora) y la de navegación, dejando que
    // reaparezcan con un swipe temporal (modo "immersive sticky") en vez de quedar
    // fijas como en una app común — el pedido era que se sienta como un juego a
    // pantalla completa de verdad, no una página web con barras del sistema.
    private void applyImmersiveMode() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = decor.getWindowInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            decor.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    // Con la navegación por gestos de Android (10+), deslizar desde el borde
    // izquierdo/derecho de la pantalla dispara el "volver atrás" del sistema — eso
    // chocaba con arrastrar fichas cerca del borde durante la partida (el juego se
    // salía solo). setSystemGestureExclusionRects le pide al sistema que ceda esa
    // franja de borde a la app en vez de interceptarla como gesto de navegación.
    private void excludeEdgeGesturesOnceLaidOut() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        final View decor = getWindow().getDecorView();
        decor.post(new Runnable() {
            @Override
            public void run() {
                int w = decor.getWidth(), h = decor.getHeight();
                if (w == 0 || h == 0) return;
                decor.setSystemGestureExclusionRects(
                    Collections.singletonList(new Rect(0, 0, w, h)));
            }
        });
    }
}
